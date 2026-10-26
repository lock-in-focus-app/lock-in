use serde::Serialize;
use ts_rs::TS;

use crate::error::{Error, Result};
use crate::session::{EndReason, GateVisit, Profile, Session, SessionRecord, starter_profiles};
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

    /// The profiles and session with when they last changed, for sending to the extension.
    pub fn synced(&self) -> (&Synced<Vec<Profile>>, &Synced<Option<Session>>) {
        (&self.profiles, &self.session)
    }

    /// Takes the extension's profiles and session where they're newer than the app's.
    /// Returns whether anything changed.
    ///
    /// A session that started in the extension gets its profile's timer here. A session the
    /// extension ended (or replaced) is logged as ending when the extension changed it.
    pub fn apply_remote(
        &mut self,
        profiles: Option<Synced<Vec<Profile>>>,
        session: Option<Synced<Option<Session>>>,
        now: i64,
    ) -> Result<bool> {
        let mut changed = false;

        // Nothing can come from the future; a clock that ran ahead mustn't freeze the app's state.
        if let Some(mut incoming) = profiles.filter(|p| p.updated_at.min(now) > self.profiles.updated_at) {
            incoming.updated_at = incoming.updated_at.min(now);
            self.store.save(PROFILES, &incoming)?;
            self.profiles = incoming;
            changed = true;
        }

        if let Some(mut incoming) = session.filter(|s| s.updated_at.min(now) > self.session.updated_at) {
            incoming.updated_at = incoming.updated_at.min(now);
            if let Some(new) = incoming.value.as_mut().filter(|s| s.timer.is_none()) {
                new.timer = Some(self.profile(&new.profile_id).map(Profile::timer).unwrap_or_default());
                // Newer than the extension's copy, so it takes the timer when this is sent back.
                incoming.updated_at += 1;
            }
            let ended = match (&self.session.value, &incoming.value) {
                (Some(previous), Some(new)) if previous.id == new.id => None,
                (previous, _) => previous.as_ref(),
            };
            match ended {
                Some(previous) => {
                    let name = self.profile_name(&previous.profile_id);
                    let ended_at = incoming.updated_at.min(now);
                    let record = SessionRecord::new(previous, &name, ended_at, EndReason::Stopped);
                    self.store.end_session(&record, ACTIVE_SESSION, &incoming)?;
                }
                None => self.store.save(ACTIVE_SESSION, &incoming)?,
            }
            self.session = incoming;
            changed = true;
        }

        Ok(changed)
    }

    /// Logs a trip to a redirected site, with the session it happened in.
    pub fn record_gate_visit(&self, visit: GateVisit) -> Result<()> {
        let visit = visit.trimmed();
        let session_id = self
            .session()
            .filter(|s| visit.at >= s.started_at)
            .map(|s| s.id.as_str());
        self.store.save_gate_visit(&visit, session_id)
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

    fn remote_session(id: &str, profile_id: &str, timer: Option<TimerSettings>) -> Session {
        Session {
            id: id.into(),
            profile_id: profile_id.into(),
            started_at: 1_000,
            timer,
            rest: serde_json::from_value(serde_json::json!({ "passes": { "reddit": 5 } })).unwrap(),
        }
    }

    #[test]
    fn takes_newer_changes_from_the_extension() {
        let mut engine = engine();
        let mut profiles = starter_profiles();
        profiles[0].name = "Essays".into();
        let changed = engine
            .apply_remote(
                Some(Synced {
                    value: profiles,
                    updated_at: 50,
                }),
                None,
                100,
            )
            .unwrap();
        assert!(changed);
        assert_eq!(engine.snapshot().profiles[0].name, "Essays");

        // Older or equal changes are ignored.
        let stale = Synced {
            value: starter_profiles(),
            updated_at: 50,
        };
        assert!(!engine.apply_remote(Some(stale), None, 100).unwrap());
        assert_eq!(engine.snapshot().profiles[0].name, "Essays");
    }

    #[test]
    fn gives_sessions_from_the_extension_their_timer() {
        let mut engine = engine();
        let incoming = Synced {
            value: Some(remote_session("s1", "writing", None)),
            updated_at: 2_000,
        };
        assert!(engine.apply_remote(None, Some(incoming), 3_000).unwrap());
        let (_, session) = engine.synced();
        assert_eq!(session.updated_at, 2_001);
        let value = session.value.as_ref().unwrap();
        assert_eq!(value.timer.as_ref().map(|t| t.minutes), Some(45));
        assert_eq!(value.rest["passes"]["reddit"], 5);
    }

    #[test]
    fn logs_sessions_the_extension_ends() {
        let mut engine = engine();
        engine.start_session("writing", 1_000).unwrap();
        let ended = Synced {
            value: None,
            updated_at: 1_000 + 30 * MIN,
        };
        assert!(engine.apply_remote(None, Some(ended), 1_000 + 31 * MIN).unwrap());
        assert_eq!(engine.session(), None);
        let log = engine.session_log().unwrap();
        assert_eq!(log.len(), 1);
        assert_eq!((log[0].ended_at, log[0].focused_ms), (1_000 + 30 * MIN, 30 * MIN));
    }

    #[test]
    fn logs_a_session_replaced_by_another() {
        let mut engine = engine();
        engine.start_session("writing", 1_000).unwrap();
        let timer = Some(TimerSettings::default());
        let replaced = Synced {
            value: Some(remote_session("s2", "deep-work", timer)),
            updated_at: 5_000,
        };
        engine.apply_remote(None, Some(replaced), 6_000).unwrap();
        assert_eq!(engine.session().map(|s| s.id.as_str()), Some("s2"));
        assert_eq!(engine.session_log().unwrap().len(), 1);
    }

    #[test]
    fn keeps_the_same_session_going() {
        let mut engine = engine();
        let id = engine.start_session("writing", 1_000).unwrap().id.clone();
        let mut same = engine.session().cloned().unwrap();
        same.rest.insert("passes".into(), serde_json::json!({ "x": 9 }));
        let incoming = Synced {
            value: Some(same),
            updated_at: 2_000,
        };
        assert!(engine.apply_remote(None, Some(incoming), 3_000).unwrap());
        assert_eq!(engine.session().map(|s| s.id.clone()), Some(id));
        assert_eq!(engine.session_log().unwrap(), vec![]);
    }

    #[test]
    fn ignores_changes_from_the_future() {
        let mut engine = engine();
        let far_future = Synced {
            value: Some(remote_session("s1", "writing", None)),
            updated_at: i64::MAX - 10,
        };
        engine.apply_remote(None, Some(far_future), 5_000).unwrap();
        assert_eq!(engine.synced().1.updated_at, 5_001);
    }

    #[test]
    fn logs_gate_visits_with_their_session() {
        let mut engine = engine();
        let visit = |id: &str, at: i64| -> GateVisit {
            serde_json::from_value(serde_json::json!({ "id": id, "recipeId": "reddit", "at": at })).unwrap()
        };
        engine.record_gate_visit(visit("before", 10)).unwrap();
        let session_id = engine.start_session("writing", 1_000).unwrap().id.clone();
        engine.record_gate_visit(visit("during", 2_000)).unwrap();
        let mut answered = visit("during", 2_000);
        answered.why = Some("bored".into());
        answered.continued = true;
        engine.record_gate_visit(answered).unwrap();

        let visits = engine.store.gate_visits().unwrap();
        assert_eq!(visits.len(), 2);
        assert_eq!(visits[0].0, None);
        assert_eq!(visits[1].0, Some(session_id));
        assert_eq!(visits[1].1.why.as_deref(), Some("bored"));
        assert!(visits[1].1.continued);
    }

    #[test]
    fn picks_up_a_running_session_after_a_restart() {
        let mut engine = engine();
        engine.start_session("wind-down", 5).unwrap();
        let reloaded = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        assert_eq!(reloaded.session().map(|s| s.profile_id.as_str()), Some("wind-down"));
    }
}
