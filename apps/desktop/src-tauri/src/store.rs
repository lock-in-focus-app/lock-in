use std::path::Path;

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Serialize, de::DeserializeOwned};

use crate::error::Result;
use crate::session::{EndReason, SessionRecord};

/// A value that's kept in step with the extension, with when it last changed.
#[derive(Clone, Debug, PartialEq)]
pub struct Synced<T> {
    pub value: T,
    /// Epoch milliseconds. 0 means it has never been changed.
    pub updated_at: i64,
}

/// The app's SQLite database: the profiles, the running session and the session log.
pub struct Store {
    db: Connection,
}

/// Each entry upgrades the database by one version. Add new ones to the end; never edit old ones.
const MIGRATIONS: &[&str] = &[r#"
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
"#];

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        Self::migrated(Connection::open(path)?)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self> {
        Self::migrated(Connection::open_in_memory()?)
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

    /// Logs a finished session and saves the new state in one go, so a crash can't log a
    /// session that still looks like it's running.
    pub fn end_session<T: Serialize>(&mut self, record: &SessionRecord, key: &str, synced: &Synced<T>) -> Result<()> {
        let tx = self.db.transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO sessions (id, profile_id, profile_name, started_at, ended_at, timer_minutes,
                focused_ms, overtime_ms, idle_tail_ms, end_reason)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
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
            ],
        )?;
        save(&tx, key, synced)?;
        tx.commit()?;
        Ok(())
    }

    /// The session log, oldest first.
    #[allow(dead_code)] // Read by insights and the night sky once they land.
    pub fn sessions(&self) -> Result<Vec<SessionRecord>> {
        let mut statement = self.db.prepare(
            "SELECT id, profile_id, profile_name, started_at, ended_at, timer_minutes,
                focused_ms, overtime_ms, idle_tail_ms, end_reason
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
