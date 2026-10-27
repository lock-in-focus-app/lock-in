use serde::Serialize;
use ts_rs::TS;

use crate::apps::{self, AppRule};
use crate::browsers::KnownBrowser;
use crate::error::{Error, Result};
use crate::satellites::{self, Satellite, SatelliteAction, SatelliteState};
use crate::session::{EndReason, GateVisit, Profile, Session, SessionRecord, starter_profiles};
use crate::settings::Settings;
use crate::store::{Store, Synced};
use crate::timer::{Strictness, TimerSettings};

const PROFILES: &str = "profiles";
const ACTIVE_SESSION: &str = "activeSession";
const SETTINGS: &str = "settings";
const BROWSERS: &str = "browsers";
const BROKEN_SESSION: &str = "brokenSession";

/// Emergency passes come back a week after they're used.
const PASS_WEEK_MS: i64 = 7 * 24 * 60 * 60_000;

/// The session engine: the source of truth for profiles and the running session. It knows
/// nothing about windows or the menu bar; the app reacts to its changes.
pub struct Engine {
    store: Store,
    profiles: Synced<Vec<Profile>>,
    session: Synced<Option<Session>>,
    settings: Settings,
    /// When each emergency pass was used (epoch ms).
    pass_uses: Vec<i64>,
    /// The browsers that have linked to the app.
    browsers: Vec<KnownBrowser>,
    /// The id of the running session, if it counts as broken.
    broken_session: Option<String>,
    /// Satellites in orbit, back or on the task list, oldest first.
    satellites: Vec<Satellite>,
}

/// Everything the UI shows, sent whenever it changes.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Snapshot {
    pub profiles: Vec<ProfileSummary>,
    pub session: Option<ActiveSession>,
    pub settings: Settings,
    /// Emergency passes left for the last 7 days.
    pub passes_left: u32,
    /// The browsers that have linked to the app, which are watched during sessions.
    pub browsers: Vec<KnownBrowser>,
    /// Whether this system can hide another app's windows, for app rules.
    pub can_hide_apps: bool,
    /// Satellites in orbit, back or on the task list, oldest first.
    pub satellites: Vec<Satellite>,
}

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProfileSummary {
    pub id: String,
    pub name: String,
    pub timer: TimerSettings,
    pub apps: Vec<AppRule>,
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
    /// A browser had to be closed during this Hard session for running without the extension.
    pub broken: bool,
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
        let settings = store
            .load(SETTINGS)?
            .map(|s: Synced<Settings>| s.value)
            .unwrap_or_default();
        let pass_uses = store.pass_uses()?;
        let browsers = store.load(BROWSERS)?.map(|s| s.value).unwrap_or_default();
        let broken_session = store.load(BROKEN_SESSION)?.and_then(|s| s.value);
        let satellites = store.live_satellites()?;
        Ok(Self {
            store,
            profiles,
            session,
            settings,
            pass_uses,
            browsers,
            broken_session,
            satellites,
        })
    }

    pub fn session(&self) -> Option<&Session> {
        self.session.value.as_ref()
    }

    pub fn settings(&self) -> &Settings {
        &self.settings
    }

    /// The apps the profile with this id closes or hides during its sessions.
    pub fn profile_apps(&self, id: &str) -> Vec<AppRule> {
        self.profile(id).map(Profile::apps).unwrap_or_default()
    }

    /// Whether the profile with this id tames any sites, so its sessions need the extension.
    pub fn profile_tames_sites(&self, id: &str) -> bool {
        self.profile(id).is_some_and(Profile::tames_sites)
    }

    pub fn browsers(&self) -> &[KnownBrowser] {
        &self.browsers
    }

    fn is_broken(&self, session: &Session) -> bool {
        self.broken_session.as_deref() == Some(session.id.as_str())
    }

    fn profile(&self, id: &str) -> Option<&Profile> {
        self.profiles.value.iter().find(|p| p.id == id)
    }

    /// Emergency passes left at `now`. Each one used comes back a week later.
    pub fn passes_left(&self, now: i64) -> u32 {
        let used = self.pass_uses.iter().filter(|&&at| at > now - PASS_WEEK_MS).count();
        self.settings.passes_per_week.saturating_sub(used as u32)
    }

    pub fn snapshot(&self, now: i64) -> Snapshot {
        Snapshot {
            profiles: self
                .profiles
                .value
                .iter()
                .map(|p| ProfileSummary {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    timer: p.timer(),
                    apps: p.apps(),
                })
                .collect(),
            session: self.session().map(|s| ActiveSession {
                id: s.id.clone(),
                profile_id: s.profile_id.clone(),
                profile_name: self.profile_name(&s.profile_id),
                started_at: s.started_at,
                timer: s.timer.clone(),
                broken: self.is_broken(s),
            }),
            settings: self.settings.clone(),
            passes_left: self.passes_left(now),
            browsers: self.browsers.clone(),
            can_hide_apps: cfg!(target_os = "macos"),
            satellites: self.satellites.clone(),
        }
    }

    pub fn profile_name(&self, id: &str) -> String {
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

    /// Ends the running session and logs it. A Hard session can only end before its timer is
    /// done with an emergency pass; a pass isn't spent on any other session.
    ///
    /// Gentle and Medium sessions ask for their pause or typing in the window. They're there to
    /// make you stop and think, not to stop you, so this doesn't check for them.
    pub fn end_session(&mut self, now: i64, reason: EndReason) -> Result<SessionRecord> {
        let session = self.session().ok_or(Error::NoSession)?;
        let hard = session.lock(now) == Some(Strictness::Hard);
        let reason = match reason {
            EndReason::Stopped if hard => return Err(Error::Locked),
            EndReason::EmergencyPass if !hard => EndReason::Stopped,
            EndReason::EmergencyPass if self.passes_left(now) == 0 => return Err(Error::NoPassesLeft),
            reason => reason,
        };
        let mut record = SessionRecord::new(session, &self.profile_name(&session.profile_id), now, reason);
        record.broken = self.is_broken(session);
        let none = Synced {
            value: None,
            updated_at: now,
        };
        self.log_end(&record, none)?;
        if reason == EndReason::EmergencyPass {
            self.pass_uses.push(now);
        }
        Ok(record)
    }

    /// Ends the session for being idle, if it's still the one with this id. Only the time up
    /// to the last input counts. Strictness doesn't apply: there's no one there to keep in.
    pub fn end_idle_session(&mut self, session_id: &str, last_input: i64, now: i64) -> Result<Option<SessionRecord>> {
        let Some(session) = self.session().filter(|s| s.id == session_id) else {
            return Ok(None);
        };
        let mut record = SessionRecord::idle(session, &self.profile_name(&session.profile_id), last_input, now);
        record.broken = self.is_broken(session);
        let none = Synced {
            value: None,
            updated_at: now,
        };
        self.log_end(&record, none)?;
        Ok(Some(record))
    }

    /// Changes the app-wide settings. While a Hard session is running, passes per week can
    /// only go down and closing browsers can't be turned off, or they'd be easy ways out.
    pub fn set_settings(&mut self, settings: Settings, now: i64) -> Result<()> {
        let settings = settings.clamped();
        let hard = self.session().and_then(|s| s.lock(now)) == Some(Strictness::Hard);
        let looser = settings.passes_per_week > self.settings.passes_per_week
            || (self.settings.close_browsers && !settings.close_browsers);
        if hard && looser {
            return Err(Error::Locked);
        }
        self.store.save(
            SETTINGS,
            &Synced {
                value: &settings,
                updated_at: now,
            },
        )?;
        self.settings = settings;
        Ok(())
    }

    /// Remembers a browser that linked to the app, so it's watched during sessions. Returns
    /// whether it's new (or renamed).
    pub fn remember_browser(&mut self, browser: KnownBrowser, now: i64) -> Result<bool> {
        if self.browsers.contains(&browser) {
            return Ok(false);
        }
        let mut browsers = self.browsers.clone();
        browsers.retain(|b| b.path != browser.path);
        browsers.push(browser);
        self.save_browsers(browsers, now)?;
        Ok(true)
    }

    /// Stops watching a browser, e.g. one that's no longer used. Only between sessions, or
    /// forgetting it would be a way around the session.
    pub fn forget_browser(&mut self, path: &str, now: i64) -> Result<()> {
        if self.session().is_some() {
            return Err(Error::SessionRunning);
        }
        let mut browsers = self.browsers.clone();
        browsers.retain(|b| b.path != path);
        self.save_browsers(browsers, now)
    }

    fn save_browsers(&mut self, browsers: Vec<KnownBrowser>, now: i64) -> Result<()> {
        self.store.save(
            BROWSERS,
            &Synced {
                value: &browsers,
                updated_at: now,
            },
        )?;
        self.browsers = browsers;
        Ok(())
    }

    /// Marks the session with this id as broken, if it's still running. Returns whether
    /// that's new.
    pub fn break_session(&mut self, session_id: &str, now: i64) -> Result<bool> {
        let running = self.session().is_some_and(|s| s.id == session_id);
        if !running || self.broken_session.as_deref() == Some(session_id) {
            return Ok(false);
        }
        self.store.save(
            BROKEN_SESSION,
            &Synced {
                value: Some(session_id),
                updated_at: now,
            },
        )?;
        self.broken_session = Some(session_id.to_owned());
        Ok(true)
    }

    /// Changes the apps a profile closes or hides. While one of its Hard sessions is running,
    /// they can only get stricter.
    pub fn set_profile_apps(&mut self, profile_id: &str, apps: Vec<AppRule>, now: i64) -> Result<()> {
        let mut apps = apps;
        apps.truncate(apps::MAX_RULES);
        let mut profiles = self.profiles.value.clone();
        let profile = profiles
            .iter_mut()
            .find(|p| p.id == profile_id)
            .ok_or(Error::UnknownProfile)?;
        let running = self.session().filter(|s| s.profile_id == profile_id);
        let hard = running.and_then(|s| s.lock(now)) == Some(Strictness::Hard);
        if hard && apps::looser(&profile.apps(), &apps) {
            return Err(Error::Locked);
        }
        profile.set_apps(&apps);
        let synced = Synced {
            value: profiles,
            updated_at: now,
        };
        self.store.save(PROFILES, &synced)?;
        self.profiles = synced;
        Ok(())
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
    /// A session that started in the extension gets its profile's timer here. After that the
    /// app owns the timer, so the extension can't change it. A session the extension ended
    /// (or replaced) is logged as ending when the extension changed it, unless it's a Hard
    /// session whose timer is still running: that one carries on, and goes back to the browser.
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
            let current = self.session().cloned();
            let same = matches!((&current, &incoming.value), (Some(c), Some(n)) if c.id == n.id);

            if !same && current.as_ref().and_then(|s| s.lock(now)) == Some(Strictness::Hard) {
                // Newer than the browser's change, so the browser takes the session back.
                self.session.updated_at = incoming.updated_at + 1;
                self.store.save(ACTIVE_SESSION, &self.session)?;
                return Ok(true);
            }

            if let Some(new) = incoming.value.as_mut() {
                let timer = match &current {
                    Some(c) if same && c.timer.is_some() => c.timer.clone(),
                    _ => new
                        .timer
                        .clone()
                        .or_else(|| Some(self.profile(&new.profile_id).map(Profile::timer).unwrap_or_default())),
                };
                if new.timer != timer {
                    new.timer = timer;
                    // Newer than the extension's copy, so it takes the timer when this is sent back.
                    incoming.updated_at += 1;
                }
            }
            let ended = match (&self.session.value, &incoming.value) {
                (Some(previous), Some(new)) if previous.id == new.id => None,
                (previous, _) => previous.as_ref(),
            };
            match ended {
                Some(previous) => {
                    let name = self.profile_name(&previous.profile_id);
                    let ended_at = incoming.updated_at.min(now);
                    let mut record = SessionRecord::new(previous, &name, ended_at, EndReason::Stopped);
                    record.broken = self.is_broken(previous);
                    self.log_end(&record, incoming)?;
                }
                None => {
                    self.store.save(ACTIVE_SESSION, &incoming)?;
                    self.session = incoming;
                }
            }
            changed = true;
        }

        Ok(changed)
    }

    /// Logs a session that ended and takes on what replaced it (no session, or one the
    /// extension started). Satellites in orbit come back.
    fn log_end(&mut self, record: &SessionRecord, replacement: Synced<Option<Session>>) -> Result<()> {
        self.store.end_session(record, ACTIVE_SESSION, &replacement)?;
        self.session = replacement;
        for satellite in &mut self.satellites {
            if satellite.state == SatelliteState::Orbiting {
                satellite.state = SatelliteState::Back;
            }
        }
        Ok(())
    }

    /// Launches a thought into orbit, to come back when the running session ends, or the next
    /// one if none is running. Returns whether there was anything to launch.
    pub fn launch_satellite(&mut self, text: &str, now: i64) -> Result<bool> {
        let Some(text) = satellites::cleaned(text) else {
            return Ok(false);
        };
        let satellite = Satellite {
            id: uuid::Uuid::new_v4().to_string(),
            text,
            launched_at: now,
            state: SatelliteState::Orbiting,
        };
        let session_id = self.session().map(|s| s.id.as_str());
        self.store.save_satellite(&satellite, session_id)?;
        self.satellites.push(satellite);
        Ok(true)
    }

    /// Ticks off, snoozes, keeps as a task or deletes a satellite.
    pub fn act_on_satellite(&mut self, id: &str, action: SatelliteAction, now: i64) -> Result<()> {
        let index = self
            .satellites
            .iter()
            .position(|s| s.id == id)
            .ok_or(Error::UnknownSatellite)?;
        let state = action.state();
        self.store.move_satellite(id, state, now)?;
        if state.is_live() {
            self.satellites[index].state = state;
        } else {
            self.satellites.remove(index);
        }
        Ok(())
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
        let snapshot = engine.snapshot(0);
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
        assert_eq!(engine.snapshot(0).session.unwrap().profile_name, "Writing");
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
            strictness: Strictness::Medium,
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
        assert_eq!(engine.snapshot(0).profiles[0].name, "Essays");

        // Older or equal changes are ignored.
        let stale = Synced {
            value: starter_profiles(),
            updated_at: 50,
        };
        assert!(!engine.apply_remote(Some(stale), None, 100).unwrap());
        assert_eq!(engine.snapshot(0).profiles[0].name, "Essays");
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

    /// An engine with Deep Work set to a 50-minute Hard timer.
    fn hard_engine() -> Engine {
        let mut engine = engine();
        let timer = TimerSettings {
            minutes: 50,
            strictness: Strictness::Hard,
            ..TimerSettings::default()
        };
        engine.set_profile_timer("deep-work", timer, 1).unwrap();
        engine
    }

    #[test]
    fn hard_sessions_end_early_only_with_a_pass() {
        let mut engine = hard_engine();
        engine.start_session("deep-work", 0).unwrap();
        assert!(matches!(
            engine.end_session(10 * MIN, EndReason::Stopped),
            Err(Error::Locked)
        ));
        assert_eq!(engine.passes_left(10 * MIN), 2);

        let record = engine.end_session(10 * MIN, EndReason::EmergencyPass).unwrap();
        assert_eq!(record.end_reason, EndReason::EmergencyPass);
        assert_eq!(engine.passes_left(10 * MIN), 1);

        // Once the timer is done it ends like any other, and no pass is spent.
        engine.start_session("deep-work", 20 * MIN).unwrap();
        let record = engine.end_session(70 * MIN, EndReason::EmergencyPass).unwrap();
        assert_eq!(record.end_reason, EndReason::Stopped);
        assert_eq!(engine.passes_left(70 * MIN), 1);
    }

    #[test]
    fn passes_run_out_and_come_back_a_week_later() {
        let mut engine = hard_engine();
        for start in [0, 10 * MIN] {
            engine.start_session("deep-work", start).unwrap();
            engine.end_session(start + MIN, EndReason::EmergencyPass).unwrap();
        }
        engine.start_session("deep-work", 20 * MIN).unwrap();
        assert!(matches!(
            engine.end_session(21 * MIN, EndReason::EmergencyPass),
            Err(Error::NoPassesLeft)
        ));
        assert_eq!(engine.snapshot(21 * MIN).passes_left, 0);
        assert_eq!(engine.passes_left(MIN + PASS_WEEK_MS), 1);

        // Kept across restarts, since they're read from the session log.
        let reloaded = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        assert_eq!(reloaded.passes_left(21 * MIN), 0);
    }

    #[test]
    fn passes_per_week_only_go_down_during_a_hard_session() {
        let mut engine = hard_engine();
        engine
            .set_settings(
                Settings {
                    passes_per_week: 99,
                    ..Settings::default()
                },
                0,
            )
            .unwrap();
        assert_eq!(
            engine.snapshot(0).settings.passes_per_week,
            crate::settings::MAX_PASSES_PER_WEEK
        );

        engine.start_session("deep-work", 0).unwrap();
        engine
            .set_settings(
                Settings {
                    passes_per_week: 1,
                    ..Settings::default()
                },
                MIN,
            )
            .unwrap();
        assert!(matches!(
            engine.set_settings(
                Settings {
                    passes_per_week: 5,
                    ..Settings::default()
                },
                MIN
            ),
            Err(Error::Locked)
        ));
        engine
            .set_settings(
                Settings {
                    passes_per_week: 5,
                    ..Settings::default()
                },
                60 * MIN,
            )
            .unwrap();
    }

    #[test]
    fn closing_browsers_stays_on_during_a_hard_session() {
        let mut engine = hard_engine();
        assert!(!engine.settings().close_browsers);
        let on = Settings {
            close_browsers: true,
            ..Settings::default()
        };
        engine.start_session("deep-work", 0).unwrap();
        // Turning it on is stricter, so that's fine; turning it off isn't, until the timer's done.
        engine.set_settings(on.clone(), MIN).unwrap();
        assert!(matches!(
            engine.set_settings(Settings::default(), 2 * MIN),
            Err(Error::Locked)
        ));
        engine.set_settings(Settings::default(), 60 * MIN).unwrap();
        assert!(!engine.settings().close_browsers);
    }

    #[test]
    fn the_extension_cannot_end_a_hard_session_early() {
        let mut engine = hard_engine();
        let id = engine.start_session("deep-work", 1_000).unwrap().id.clone();
        let ended = Synced {
            value: None,
            updated_at: 10 * MIN,
        };
        assert!(engine.apply_remote(None, Some(ended), 11 * MIN).unwrap());
        let (_, session) = engine.synced();
        assert_eq!(session.value.as_ref().map(|s| s.id.clone()), Some(id));
        // Newer than the browser's change, so the browser takes it back.
        assert_eq!(session.updated_at, 10 * MIN + 1);
        assert_eq!(engine.session_log().unwrap(), vec![]);

        // Once the timer is done, it can.
        let ended = Synced {
            value: None,
            updated_at: 60 * MIN,
        };
        engine.apply_remote(None, Some(ended), 60 * MIN).unwrap();
        assert_eq!(engine.session(), None);
    }

    #[test]
    fn the_app_owns_a_running_session_timer() {
        let mut engine = hard_engine();
        engine.start_session("deep-work", 1_000).unwrap();
        let mut softened = engine.session().cloned().unwrap();
        softened.timer = Some(TimerSettings {
            minutes: 0,
            ..TimerSettings::default()
        });
        let incoming = Synced {
            value: Some(softened),
            updated_at: 2_000,
        };
        engine.apply_remote(None, Some(incoming), 3_000).unwrap();
        let (_, session) = engine.synced();
        let timer = session.value.as_ref().unwrap().timer.as_ref().unwrap();
        assert_eq!((timer.minutes, timer.strictness), (50, Strictness::Hard));
        assert_eq!(session.updated_at, 2_001);
    }

    #[test]
    fn ends_idle_sessions_without_the_time_away() {
        let mut engine = hard_engine();
        let id = engine.start_session("deep-work", 0).unwrap().id.clone();
        assert_eq!(engine.end_idle_session("other", 5 * MIN, 20 * MIN).unwrap(), None);

        let record = engine.end_idle_session(&id, 5 * MIN, 20 * MIN).unwrap().unwrap();
        assert_eq!((record.focused_ms, record.idle_tail_ms), (5 * MIN, 15 * MIN));
        assert_eq!(engine.session(), None);
        assert_eq!(engine.session_log().unwrap(), vec![record]);
    }

    fn chrome(name: &str) -> KnownBrowser {
        KnownBrowser {
            name: name.into(),
            path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into(),
        }
    }

    #[test]
    fn remembers_browsers_until_forgotten_between_sessions() {
        let mut engine = engine();
        assert!(engine.remember_browser(chrome("Google Chrome"), 1).unwrap());
        assert!(!engine.remember_browser(chrome("Google Chrome"), 2).unwrap());
        // Same browser, new name: replaced, not added.
        assert!(engine.remember_browser(chrome("Chrome"), 3).unwrap());
        assert_eq!(engine.snapshot(3).browsers, vec![chrome("Chrome")]);

        engine.start_session("deep-work", 4).unwrap();
        assert!(matches!(
            engine.forget_browser(&chrome("Chrome").path, 5),
            Err(Error::SessionRunning)
        ));
        engine.end_session(5, EndReason::Stopped).unwrap();
        engine.forget_browser(&chrome("Chrome").path, 6).unwrap();
        assert_eq!(engine.browsers(), &[]);

        engine.remember_browser(chrome("Chrome"), 7).unwrap();
        let reloaded = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        assert_eq!(reloaded.browsers(), &[chrome("Chrome")]);
    }

    #[test]
    fn logs_a_broken_session_as_broken() {
        let mut engine = hard_engine();
        let id = engine.start_session("deep-work", 0).unwrap().id.clone();
        assert!(!engine.break_session("other", MIN).unwrap());
        assert!(engine.break_session(&id, MIN).unwrap());
        assert!(!engine.break_session(&id, 2 * MIN).unwrap());
        assert!(engine.snapshot(2 * MIN).session.unwrap().broken);

        // Still broken after a restart, and in the log once it ends.
        let mut engine = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        let record = engine.end_session(60 * MIN, EndReason::Stopped).unwrap();
        assert!(record.broken);
        assert_eq!(engine.session_log().unwrap(), vec![record]);

        // The next session starts whole.
        engine.start_session("deep-work", 61 * MIN).unwrap();
        assert!(!engine.snapshot(61 * MIN).session.unwrap().broken);
    }

    #[test]
    fn app_rules_only_get_stricter_during_a_hard_session() {
        use crate::apps::AppAction;
        let rule = |name: &str, action| AppRule {
            name: name.into(),
            path: format!("/Applications/{name}.app/Contents/MacOS/{name}"),
            action,
        };
        let mut engine = hard_engine();
        let discord = vec![rule("Discord", AppAction::Close)];
        engine.set_profile_apps("deep-work", discord.clone(), 1).unwrap();
        assert_eq!(engine.profile_apps("deep-work"), discord);
        assert_eq!(engine.snapshot(1).profiles[1].apps, discord);
        assert!(matches!(
            engine.set_profile_apps("nope", vec![], 1),
            Err(Error::UnknownProfile)
        ));

        engine.start_session("deep-work", 0).unwrap();
        let more = vec![rule("Discord", AppAction::Close), rule("Steam", AppAction::Hide)];
        engine.set_profile_apps("deep-work", more.clone(), MIN).unwrap();
        for looser in [
            vec![],
            vec![rule("Discord", AppAction::Hide), rule("Steam", AppAction::Hide)],
        ] {
            assert!(matches!(
                engine.set_profile_apps("deep-work", looser, MIN),
                Err(Error::Locked)
            ));
        }
        // Other profiles, and this one once the timer's done, can change freely.
        engine.set_profile_apps("writing", vec![], MIN).unwrap();
        engine.set_profile_apps("deep-work", vec![], 60 * MIN).unwrap();
        assert_eq!(engine.profile_apps("deep-work"), vec![]);
    }

    #[test]
    fn picks_up_a_running_session_after_a_restart() {
        let mut engine = engine();
        engine.start_session("wind-down", 5).unwrap();
        let reloaded = Engine::load(std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap())).unwrap();
        assert_eq!(reloaded.session().map(|s| s.profile_id.as_str()), Some("wind-down"));
    }

    /// The satellites' text and state, oldest first.
    fn satellites(engine: &Engine) -> Vec<(&str, SatelliteState)> {
        engine.satellites.iter().map(|s| (s.text.as_str(), s.state)).collect()
    }

    fn satellite_id(engine: &Engine, text: &str) -> String {
        engine.satellites.iter().find(|s| s.text == text).unwrap().id.clone()
    }

    #[test]
    fn satellites_come_back_when_the_session_ends() {
        let mut engine = engine();
        engine.start_session("writing", 0).unwrap();
        assert!(engine.launch_satellite("  reply to Sam ", MIN).unwrap());
        assert!(!engine.launch_satellite(" \n ", MIN).unwrap());
        assert_eq!(satellites(&engine), vec![("reply to Sam", SatelliteState::Orbiting)]);

        engine.end_session(60 * MIN, EndReason::Stopped).unwrap();
        assert_eq!(satellites(&engine), vec![("reply to Sam", SatelliteState::Back)]);
        assert_eq!(engine.snapshot(60 * MIN).satellites, engine.satellites);

        // Launched between sessions, it waits for the next one to end.
        engine.launch_satellite("book dentist", 61 * MIN).unwrap();
        engine.start_session("writing", 62 * MIN).unwrap();
        engine.end_session(70 * MIN, EndReason::Stopped).unwrap();
        assert_eq!(
            satellites(&engine),
            vec![
                ("reply to Sam", SatelliteState::Back),
                ("book dentist", SatelliteState::Back)
            ]
        );
    }

    #[test]
    fn satellites_come_back_however_the_session_ends() {
        let mut engine = engine();
        engine.start_session("writing", 0).unwrap();
        engine.launch_satellite("idle", MIN).unwrap();
        let id = engine.session().unwrap().id.clone();
        engine.end_idle_session(&id, 2 * MIN, 10 * MIN).unwrap();
        assert_eq!(satellites(&engine), vec![("idle", SatelliteState::Back)]);

        let mut engine = self::engine();
        engine.start_session("writing", 0).unwrap();
        engine.launch_satellite("browser", MIN).unwrap();
        let ended = Synced {
            value: None,
            updated_at: 5 * MIN,
        };
        engine.apply_remote(None, Some(ended), 5 * MIN).unwrap();
        assert_eq!(satellites(&engine), vec![("browser", SatelliteState::Back)]);
    }

    #[test]
    fn acts_on_satellites_that_came_back() {
        let mut engine = engine();
        for text in ["done", "snooze", "task", "delete"] {
            engine.launch_satellite(text, 0).unwrap();
        }
        engine.start_session("writing", MIN).unwrap();
        engine.end_session(2 * MIN, EndReason::Stopped).unwrap();

        let act = |engine: &mut Engine, text: &str, action| {
            let id = satellite_id(engine, text);
            engine.act_on_satellite(&id, action, 3 * MIN).unwrap();
        };
        act(&mut engine, "done", SatelliteAction::Done);
        act(&mut engine, "snooze", SatelliteAction::Snooze);
        act(&mut engine, "task", SatelliteAction::Task);
        act(&mut engine, "delete", SatelliteAction::Delete);
        assert_eq!(
            satellites(&engine),
            vec![("snooze", SatelliteState::Orbiting), ("task", SatelliteState::Task)]
        );
        assert!(matches!(
            engine.act_on_satellite("nope", SatelliteAction::Done, 0),
            Err(Error::UnknownSatellite)
        ));

        // Snoozed ones come back after the next session; tasks stay on the list.
        engine.start_session("writing", 4 * MIN).unwrap();
        engine.end_session(5 * MIN, EndReason::Stopped).unwrap();
        assert_eq!(
            satellites(&engine),
            vec![("snooze", SatelliteState::Back), ("task", SatelliteState::Task)]
        );

        // Ticking off a task takes it off the list.
        act(&mut engine, "task", SatelliteAction::Done);
        assert_eq!(satellites(&engine), vec![("snooze", SatelliteState::Back)]);
    }

    #[test]
    fn keeps_satellites_through_a_restart_but_not_deleted_text() {
        let mut engine = engine();
        engine.launch_satellite("keep me", 0).unwrap();
        engine.launch_satellite("secret", 0).unwrap();
        let id = satellite_id(&engine, "secret");
        engine.act_on_satellite(&id, SatelliteAction::Delete, MIN).unwrap();

        let store = std::mem::replace(&mut engine.store, Store::open_in_memory().unwrap());
        let texts: Vec<String> = store
            .db_for_tests()
            .prepare("SELECT text FROM satellites ORDER BY text")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(texts, vec!["", "keep me"]);

        let reloaded = Engine::load(store).unwrap();
        assert_eq!(satellites(&reloaded), vec![("keep me", SatelliteState::Orbiting)]);
    }
}
