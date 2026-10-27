use std::path::Path;

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::error::Result;
use crate::satellites::{Satellite, SatelliteState};
use crate::session::{EndReason, GateVisit, SessionRecord};

/// A value that's kept in step with the extension, with when it last changed. The newest
/// change wins.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Synced<T> {
    pub value: T,
    /// Epoch milliseconds. 0 means it has never been changed.
    pub updated_at: i64,
}

/// The app's SQLite database: the profiles, the running session, the session log and
/// satellites.
pub struct Store {
    db: Connection,
}

/// Each entry upgrades the database by one version. Add new ones to the end; never edit old ones.
const MIGRATIONS: &[&str] = &[
    r#"
    CREATE TABLE state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        profile_name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        timer_minutes INTEGER,
        focused_ms INTEGER NOT NULL,
        overtime_ms INTEGER NOT NULL,
        idle_tail_ms INTEGER NOT NULL,
        end_reason TEXT NOT NULL
    );
    CREATE INDEX sessions_started_at ON sessions (started_at);
"#,
    r#"
    CREATE TABLE gate_visits (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        recipe_id TEXT NOT NULL,
        at INTEGER NOT NULL,
        destination TEXT,
        why TEXT,
        intention TEXT,
        continued INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX gate_visits_at ON gate_visits (at);
"#,
    r#"
    ALTER TABLE sessions ADD COLUMN broken INTEGER NOT NULL DEFAULT 0;
"#,
    // Satellites that are done or deleted stay, for insights, but deleted ones lose their text.
    r#"
    CREATE TABLE satellites (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        launched_at INTEGER NOT NULL,
        session_id TEXT,
        state TEXT NOT NULL,
        state_at INTEGER NOT NULL,
        snoozes INTEGER NOT NULL DEFAULT 0,
        tasked_at INTEGER
    );
    CREATE INDEX satellites_state ON satellites (state);
"#,
];

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        Self::migrated(Connection::open(path)?)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self> {
        Self::migrated(Connection::open_in_memory()?)
    }

    #[cfg(test)]
    pub fn db_for_tests(&self) -> &Connection {
        &self.db
    }

    fn migrated(mut db: Connection) -> Result<Self> {
        let version: i64 = db.pragma_query_value(None, "user_version", |row| row.get(0))?;
        let tx = db.transaction()?;
        for (index, migration) in (0_i64..).zip(MIGRATIONS).skip(version as usize) {
            tx.execute_batch(migration)?;
            tx.pragma_update(None, "user_version", index + 1)?;
        }
        tx.commit()?;
        Ok(Self { db })
    }

    pub fn load<T: DeserializeOwned>(&self, key: &str) -> Result<Option<Synced<T>>> {
        let row = self
            .db
            .query_row(
                "SELECT value, updated_at FROM state WHERE key = ?1",
                params![key],
                |row| Ok((row.get::<_, String>(0)?, row.get(1)?)),
            )
            .optional()?;
        let Some((json, updated_at)) = row else {
            return Ok(None);
        };
        Ok(Some(Synced {
            value: serde_json::from_str(&json)?,
            updated_at,
        }))
    }

    pub fn save<T: Serialize>(&self, key: &str, synced: &Synced<T>) -> Result<()> {
        save(&self.db, key, synced)
    }

    /// Logs a finished session, saves the new state and brings satellites back, all in one go,
    /// so a crash can't log a session that still looks like it's running.
    pub fn end_session<T: Serialize>(&mut self, record: &SessionRecord, key: &str, synced: &Synced<T>) -> Result<()> {
        let tx = self.db.transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO sessions (id, profile_id, profile_name, started_at, ended_at, timer_minutes,
                focused_ms, overtime_ms, idle_tail_ms, end_reason, broken)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                record.id,
                record.profile_id,
                record.profile_name,
                record.started_at,
                record.ended_at,
                record.timer_minutes,
                record.focused_ms,
                record.overtime_ms,
                record.idle_tail_ms,
                record.end_reason.as_str(),
                record.broken,
            ],
        )?;
        save(&tx, key, synced)?;
        tx.execute(
            "UPDATE satellites SET state = ?1, state_at = ?2 WHERE state = ?3",
            params![
                SatelliteState::Back.as_str(),
                record.ended_at,
                SatelliteState::Orbiting.as_str()
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn save_satellite(&self, satellite: &Satellite, session_id: Option<&str>) -> Result<()> {
        self.db.execute(
            "INSERT INTO satellites (id, text, launched_at, session_id, state, state_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?3)",
            params![
                satellite.id,
                satellite.text,
                satellite.launched_at,
                session_id,
                satellite.state.as_str()
            ],
        )?;
        Ok(())
    }

    /// Moves a satellite to `state`, counting snoozes and when it first became a task.
    pub fn move_satellite(&self, id: &str, state: SatelliteState, now: i64) -> Result<()> {
        let extra = match state {
            SatelliteState::Orbiting => ", snoozes = snoozes + 1",
            SatelliteState::Task => ", tasked_at = COALESCE(tasked_at, ?3)",
            SatelliteState::Deleted => ", text = ''",
            SatelliteState::Back | SatelliteState::Done => "",
        };
        self.db.execute(
            &format!("UPDATE satellites SET state = ?2, state_at = ?3{extra} WHERE id = ?1"),
            params![id, state.as_str(), now],
        )?;
        Ok(())
    }

    /// The satellites still in orbit, back or on the task list, and tasks ticked off since
    /// `done_since`, oldest first.
    pub fn shown_satellites(&self, done_since: i64) -> Result<Vec<Satellite>> {
        let mut statement = self.db.prepare(
            "SELECT id, text, launched_at, state, state_at FROM satellites
             WHERE state IN (?1, ?2, ?3) OR (state = ?4 AND tasked_at IS NOT NULL AND state_at >= ?5)
             ORDER BY launched_at",
        )?;
        let rows = statement.query_map(
            params![
                SatelliteState::Orbiting.as_str(),
                SatelliteState::Back.as_str(),
                SatelliteState::Task.as_str(),
                SatelliteState::Done.as_str(),
                done_since
            ],
            |row| {
                Ok(Satellite {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    launched_at: row.get(2)?,
                    state: SatelliteState::parse(&row.get::<_, String>(3)?).unwrap_or(SatelliteState::Back),
                    state_at: row.get(4)?,
                })
            },
        )?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Saves a trip to a redirected site. The extension sends it again as the user answers
    /// "why?" or continues, so later sends update it, keeping the session it started in.
    pub fn save_gate_visit(&self, visit: &GateVisit, session_id: Option<&str>) -> Result<()> {
        self.db.execute(
            "INSERT INTO gate_visits (id, session_id, recipe_id, at, destination, why, intention, continued)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT (id) DO UPDATE SET destination = excluded.destination, why = excluded.why,
                intention = excluded.intention, continued = excluded.continued",
            params![
                visit.id,
                session_id,
                visit.recipe_id,
                visit.at,
                visit.destination,
                visit.why,
                visit.intention,
                visit.continued,
            ],
        )?;
        Ok(())
    }

    /// Gate visits as (session id, visit), oldest first.
    #[allow(dead_code)] // Read by insights and the night sky once they land.
    pub fn gate_visits(&self) -> Result<Vec<(Option<String>, GateVisit)>> {
        let mut statement = self.db.prepare(
            "SELECT session_id, id, recipe_id, at, destination, why, intention, continued
             FROM gate_visits ORDER BY at",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get(0)?,
                GateVisit {
                    id: row.get(1)?,
                    recipe_id: row.get(2)?,
                    at: row.get(3)?,
                    destination: row.get(4)?,
                    why: row.get(5)?,
                    intention: row.get(6)?,
                    continued: row.get(7)?,
                },
            ))
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// When each emergency pass was used (epoch ms), oldest first.
    pub fn pass_uses(&self) -> Result<Vec<i64>> {
        let mut statement = self
            .db
            .prepare("SELECT ended_at FROM sessions WHERE end_reason = ?1 ORDER BY ended_at")?;
        let rows = statement.query_map(params![EndReason::EmergencyPass.as_str()], |row| row.get(0))?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// The session log, oldest first.
    #[allow(dead_code)] // Read by insights and the night sky once they land.
    pub fn sessions(&self) -> Result<Vec<SessionRecord>> {
        let mut statement = self.db.prepare(
            "SELECT id, profile_id, profile_name, started_at, ended_at, timer_minutes,
                focused_ms, overtime_ms, idle_tail_ms, end_reason, broken
             FROM sessions ORDER BY started_at",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                profile_name: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                timer_minutes: row.get(5)?,
                focused_ms: row.get(6)?,
                overtime_ms: row.get(7)?,
                idle_tail_ms: row.get(8)?,
                end_reason: EndReason::parse(&row.get::<_, String>(9)?).unwrap_or(EndReason::Stopped),
                broken: row.get(10)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }
}

fn save<T: Serialize>(db: &Connection, key: &str, synced: &Synced<T>) -> Result<()> {
    db.execute(
        "INSERT INTO state (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, serde_json::to_string(&synced.value)?, synced.updated_at],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_and_loads_state() {
        let store = Store::open_in_memory().unwrap();
        assert_eq!(store.load::<Vec<String>>("profiles").unwrap(), None);

        let synced = Synced {
            value: vec!["a".to_string()],
            updated_at: 42,
        };
        store.save("profiles", &synced).unwrap();
        store
            .save(
                "profiles",
                &Synced {
                    value: vec!["b".to_string()],
                    updated_at: 43,
                },
            )
            .unwrap();
        assert_eq!(
            store.load::<Vec<String>>("profiles").unwrap(),
            Some(Synced {
                value: vec!["b".to_string()],
                updated_at: 43
            })
        );
    }

    #[test]
    fn migrations_run_once() {
        let dir = std::env::temp_dir().join(format!("lock-in-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.db");
        Store::open(&path)
            .unwrap()
            .save(
                "k",
                &Synced {
                    value: 1,
                    updated_at: 1,
                },
            )
            .unwrap();
        let reopened = Store::open(&path).unwrap();
        assert_eq!(reopened.load::<i32>("k").unwrap().map(|s| s.value), Some(1));
        std::fs::remove_dir_all(dir).unwrap();
    }
}
