use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use ts_rs::TS;

use crate::timer::TimerSettings;

/// A profile, as the extension saves it. The app only reads a few fields; everything else
/// (site levels, redirect settings) is kept as it is, so nothing is lost when it's saved back.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub rest: Map<String, Value>,
}

impl Profile {
    pub fn timer(&self) -> TimerSettings {
        TimerSettings::from_saved(self.rest.get("timer"))
    }

    pub fn set_timer(&mut self, timer: &TimerSettings) {
        let value = serde_json::to_value(timer).expect("timer settings serialize");
        self.rest.insert("timer".into(), value);
    }
}

/// The profiles every new install starts with, shared with the extension.
pub fn starter_profiles() -> Vec<Profile> {
    serde_json::from_str(include_str!("../../../../packages/core/src/starter-profiles.json"))
        .expect("starter profiles are valid")
}

/// The running session. Like profiles, fields the app doesn't use (the extension's toggle
/// overrides and passes) are kept as they are.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub profile_id: String,
    /// Epoch milliseconds.
    pub started_at: i64,
    /// The timer for this session, copied from its profile when it started.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timer: Option<TimerSettings>,
    #[serde(flatten)]
    pub rest: Map<String, Value>,
}

/// Why a session ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum EndReason {
    /// The user ended it.
    Stopped,
}

impl EndReason {
    pub fn as_str(self) -> &'static str {
        match self {
            EndReason::Stopped => "stopped",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "stopped" => Some(EndReason::Stopped),
            _ => None,
        }
    }
}

/// A finished session, as kept in the session log. It holds everything the night sky will
/// need later, so stars and stardust can be worked out from past sessions.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SessionRecord {
    pub id: String,
    pub profile_id: String,
    /// The profile's name when the session ended, in case it's renamed or deleted later.
    pub profile_name: String,
    /// Epoch milliseconds.
    pub started_at: i64,
    pub ended_at: i64,
    /// The session's timer length, if it had one.
    pub timer_minutes: Option<u32>,
    /// Time spent before the timer was done, or the whole session if it had no timer.
    pub focused_ms: i64,
    /// Time spent after the timer was done.
    pub overtime_ms: i64,
    /// Idle time at the end that doesn't count. Always 0 until idle detection lands.
    pub idle_tail_ms: i64,
    pub end_reason: EndReason,
}

impl SessionRecord {
    pub fn new(session: &Session, profile_name: &str, ended_at: i64, end_reason: EndReason) -> Self {
        let ended_at = ended_at.max(session.started_at);
        let timer_minutes = session.timer.as_ref().map(|t| t.minutes).filter(|&m| m > 0);
        let done_at = session.timer.as_ref().and_then(|t| t.done_at(session.started_at));
        let split = done_at.map_or(ended_at, |done| done.min(ended_at));
        Self {
            id: session.id.clone(),
            profile_id: session.profile_id.clone(),
            profile_name: profile_name.to_owned(),
            started_at: session.started_at,
            ended_at,
            timer_minutes,
            focused_ms: split - session.started_at,
            overtime_ms: ended_at - split,
            idle_tail_ms: 0,
            end_reason,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const MIN: i64 = 60_000;

    fn session(timer_minutes: Option<u32>) -> Session {
        Session {
            id: "s1".into(),
            profile_id: "writing".into(),
            started_at: 1_000_000,
            timer: timer_minutes.map(|minutes| TimerSettings {
                minutes,
                ..TimerSettings::default()
            }),
            rest: Map::new(),
        }
    }

    #[test]
    fn keeps_fields_it_does_not_know() {
        let saved = json!({
            "id": "s1",
            "profileId": "writing",
            "startedAt": 5,
            "passes": { "reddit": 99 },
            "overrides": { "youtube": { "grayscale": false } }
        });
        let parsed: Session = serde_json::from_value(saved.clone()).unwrap();
        assert_eq!(parsed.timer, None);
        assert_eq!(serde_json::to_value(&parsed).unwrap(), saved);

        let profile = json!({ "id": "p", "name": "P", "sites": [{ "recipeId": "x", "level": "redirected" }] });
        let parsed: Profile = serde_json::from_value(profile.clone()).unwrap();
        assert_eq!(serde_json::to_value(&parsed).unwrap(), profile);
    }

    #[test]
    fn loads_the_starter_profiles() {
        let profiles = starter_profiles();
        let names: Vec<_> = profiles.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["Writing", "Deep Work", "Wind Down"]);
        assert_eq!(profiles[0].timer().minutes, 45);
    }

    #[test]
    fn splits_focus_from_overtime() {
        let record = SessionRecord::new(&session(Some(25)), "Writing", 1_000_000 + 40 * MIN, EndReason::Stopped);
        assert_eq!(record.timer_minutes, Some(25));
        assert_eq!(record.focused_ms, 25 * MIN);
        assert_eq!(record.overtime_ms, 15 * MIN);

        let early = SessionRecord::new(&session(Some(25)), "Writing", 1_000_000 + 10 * MIN, EndReason::Stopped);
        assert_eq!((early.focused_ms, early.overtime_ms), (10 * MIN, 0));
    }

    #[test]
    fn counts_all_of_it_as_focus_without_a_timer() {
        for timer in [None, Some(0)] {
            let record = SessionRecord::new(&session(timer), "Writing", 1_000_000 + 40 * MIN, EndReason::Stopped);
            assert_eq!(record.timer_minutes, None);
            assert_eq!((record.focused_ms, record.overtime_ms), (40 * MIN, 0));
        }
    }

    #[test]
    fn never_runs_backwards() {
        let record = SessionRecord::new(&session(Some(25)), "Writing", 0, EndReason::Stopped);
        assert_eq!(
            (record.ended_at, record.focused_ms, record.overtime_ms),
            (1_000_000, 0, 0)
        );
    }
}
