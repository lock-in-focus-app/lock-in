use serde::Serialize;
use ts_rs::TS;

use crate::error::{Error, Result};
use crate::session::{EndReason, Profile, Session, SessionRecord, starter_profiles};
use crate::store::{Store, Synced};
use crate::timer::TimerSettings;

const PROFILES: &str = "profiles";
const ACTIVE_SESSION: &str = "activeSession";

/// The session engine: the source of truth for profiles and the running session. It knows
/// nothing about windows or the menu bar; the app reacts to its changes.
pub struct Engine {
    store: Store,
    profiles: Synced<Vec<Profile>>,
    session: Synced<Option<Session>>,
}

/// Everything the UI shows, sent whenever it changes.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Snapshot {
    pub profiles: Vec<ProfileSummary>,
    pub session: Option<ActiveSession>,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProfileSummary {
    pub id: String,
    pub name: String,
    pub timer: TimerSettings,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ActiveSession {
    pub id: String,
    pub profile_id: String,
    pub profile_name: String,
    /// Epoch milliseconds.
    pub started_at: i64,
    pub timer: Option<TimerSettings>,
}

impl Engine {
    /// Loads saved state. A new install starts with the starter profiles, marked as never
    /// changed so the extension's own profiles win when it first connects.
    pub fn load(store: Store) -> Result<Self> {
        let profiles = store.load(PROFILES)?.unwrap_or_else(|| Synced {
            value: starter_profiles(),
            updated_at: 0,
        });
        let session = store.load(ACTIVE_SESSION)?.unwrap_or(Synced {
            value: None,
            updated_at: 0,
        });
        Ok(Self {
            store,
            profiles,
            session,
        })
    }

    pub fn session(&self) -> Option<&Session> {
        self.session.value.as_ref()
    }

    fn profile(&self, id: &str) -> Option<&Profile> {
        self.profiles.value.iter().find(|p| p.id == id)
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            profiles: self
                .profiles
                .value
                .iter()
                .map(|p| ProfileSummary {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    timer: p.timer(),
                })
                .collect(),
            session: self.session().map(|s| ActiveSession {
                id: s.id.clone(),
                profile_id: s.profile_id.clone(),
                profile_name: self.profile_name(&s.profile_id),
                started_at: s.started_at,
                timer: s.timer.clone(),
            }),
        }
    }

    fn profile_name(&self, id: &str) -> String {
        self.profile(id)
            .map_or_else(|| "Unknown profile".into(), |p| p.name.clone())
    }

    pub fn start_session(&mut self, profile_id: &str, now: i64) -> Result<&Session> {
        if self.session.value.is_some() {
            return Err(Error::SessionRunning);
        }
        let profile = self.profile(profile_id).ok_or(Error::UnknownProfile)?;
        let session = Session {
            id: uuid::Uuid::new_v4().to_string(),
            profile_id: profile.id.clone(),
            started_at: now,
            timer: Some(profile.timer()),
            rest: Default::default(),
        };
        let synced = Synced {
            value: Some(session),
            updated_at: now,
        };
        self.store.save(ACTIVE_SESSION, &synced)?;
        self.session = synced;
        Ok(self.session().expect("just started"))
    }

    /// Ends the running session and logs it.
    pub fn end_session(&mut self, now: i64, reason: EndReason) -> Result<SessionRecord> {
        let session = self.session().ok_or(Error::NoSession)?;
        let record = SessionRecord::new(session, &self.profile_name(&session.profile_id), now, reason);
        let synced = Synced {
            value: None,
            updated_at: now,
        };
        self.store.end_session(&record, ACTIVE_SESSION, &synced)?;
        self.session = synced;
        Ok(record)
    }

    /// Changes a profile's timer, for every future session that uses it.
    pub fn set_profile_timer(&mut self, profile_id: &str, timer: TimerSettings, now: i64) -> Result<()> {
        let mut profiles = self.profiles.value.clone();
        let profile = profiles
            .iter_mut()
            .find(|p| p.id == profile_id)
            .ok_or(Error::UnknownProfile)?;
        profile.set_timer(&timer.clamped());
        let synced = Synced {
            value: profiles,
            updated_at: now,
        };
        self.store.save(PROFILES, &synced)?;
        self.profiles = synced;
        Ok(())
    }

    /// The session log, oldest first.
    #[allow(dead_code)] // Read by insights and the night sky once they land.
    pub fn session_log(&self) -> Result<Vec<SessionRecord>> {
        self.store.sessions()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timer::TimerEnd;

    const MIN: i64 = 60_000;

    fn engine() -> Engine {
        Engine::load(Store::open_in_memory().unwrap()).unwrap()
    }

    #[test]
    fn starts_with_the_starter_profiles() {
        let engine = engine();
        assert_eq!(engine.profiles.updated_at, 0);
        let snapshot = engine.snapshot();
        assert_eq!(snapshot.profiles.len(), 3);
        assert_eq!(snapshot.session, None);
    }

    #[test]
    fn runs_a_session_with_the_profile_timer() {
        let mut engine = engine();
        let session = engine.start_session("writing", 1_000).unwrap();
        assert_eq!(
            session.timer.as_ref().map(|t| (t.minutes, t.on_end)),
            Some((45, TimerEnd::Silent))
        );
        assert_eq!(engine.snapshot().session.unwrap().profile_name, "Writing");
        assert!(matches!(
            engine.start_session("deep-work", 2_000),
            Err(Error::SessionRunning)
        ));

        let record = engine.end_session(1_000 + 50 * MIN, EndReason::Stopped).unwrap();
        assert_eq!((record.focused_ms, record.overtime_ms), (45 * MIN, 5 * MIN));
        assert_eq!(engine.session(), None);
        assert_eq!(engine.session_log().unwrap(), vec![record]);
        assert!(matches!(
            engine.end_session(0, EndReason::Stopped),
            Err(Error::NoSession)
        ));
    }

    #[test]
    fn rejects_unknown_profiles() {
        let mut engine = engine();
        assert!(matches!(engine.start_session("nope", 1), Err(Error::UnknownProfile)));
        assert!(matches!(
            engine.set_profile_timer("nope", TimerSettings::default(), 1),
            Err(Error::UnknownProfile)
        ));
    }

    #[test]
    fn saves_profile_timers_for_next_time() {
        let mut engine = engine();
        let timer = TimerSettings {
            minutes: 9_999,
            on_end: TimerEnd::Alert,
            show_since_done: true,
        };
        engine.set_profile_timer("deep-work", timer, 7).unwrap();

        let reloaded = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        let deep_work = reloaded.profile("deep-work").unwrap();
        assert_eq!(deep_work.timer().minutes, crate::timer::MAX_MINUTES);
        assert_eq!(deep_work.timer().on_end, TimerEnd::Alert);
        assert_eq!(reloaded.profiles.updated_at, 7);
    }

    #[test]
    fn picks_up_a_running_session_after_a_restart() {
        let mut engine = engine();
        engine.start_session("wind-down", 5).unwrap();
        let reloaded = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        assert_eq!(reloaded.session().map(|s| s.profile_id.as_str()), Some("wind-down"));
    }
}
