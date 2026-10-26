use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

/// What happens when a session's timer runs out. The session keeps going either way.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TimerEnd {
    /// Nothing at all: no notification, sound or menu-bar change.
    Silent,
    /// A quiet notification.
    Gentle,
    /// A notification with a sound.
    Alert,
}

/// The quiet timer: a starting ramp, not a cage. It never ends the session.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TimerSettings {
    /// Minutes until the timer is done. 0 means no timer.
    pub minutes: u32,
    pub on_end: TimerEnd,
    /// Whether a finished timer shows "Done · 37 min ago" instead of just "Done".
    pub show_since_done: bool,
}

pub const MAX_MINUTES: u32 = 480;

impl Default for TimerSettings {
    fn default() -> Self {
        Self {
            minutes: 25,
            on_end: TimerEnd::Gentle,
            show_since_done: false,
        }
    }
}

impl TimerSettings {
    /// A profile's saved timer with defaults filled in. Profiles come from the extension and
    /// may have been edited or imported, so anything unexpected falls back to the default.
    pub fn from_saved(saved: Option<&Value>) -> Self {
        let defaults = Self::default();
        let Some(saved) = saved else {
            return defaults;
        };
        let minutes = saved
            .get("minutes")
            .and_then(Value::as_f64)
            .filter(|m| m.is_finite())
            .map_or(defaults.minutes, |m| m.round().clamp(0.0, MAX_MINUTES as f64) as u32);
        let on_end = saved
            .get("onEnd")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(defaults.on_end);
        let show_since_done = saved
            .get("showSinceDone")
            .and_then(Value::as_bool)
            .unwrap_or(defaults.show_since_done);
        Self {
            minutes,
            on_end,
            show_since_done,
        }
    }

    /// The same settings with minutes kept in range, for values that come from the UI.
    pub fn clamped(mut self) -> Self {
        self.minutes = self.minutes.min(MAX_MINUTES);
        self
    }

    /// When the timer is done (epoch ms) for a session that started at `started_at`, if it has one.
    pub fn done_at(&self, started_at: i64) -> Option<i64> {
        (self.minutes > 0).then(|| started_at + i64::from(self.minutes) * 60_000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fills_in_defaults() {
        assert_eq!(TimerSettings::from_saved(None), TimerSettings::default());
        assert_eq!(
            TimerSettings::from_saved(Some(&json!({ "minutes": 45, "onEnd": "silent" }))),
            TimerSettings {
                minutes: 45,
                on_end: TimerEnd::Silent,
                show_since_done: false
            }
        );
    }

    #[test]
    fn cleans_up_bad_values() {
        let saved = json!({ "minutes": 9999.6, "onEnd": "explode", "showSinceDone": "yes" });
        assert_eq!(
            TimerSettings::from_saved(Some(&saved)),
            TimerSettings {
                minutes: MAX_MINUTES,
                ..TimerSettings::default()
            }
        );
        assert_eq!(TimerSettings::from_saved(Some(&json!({ "minutes": -5 }))).minutes, 0);
        assert_eq!(TimerSettings::from_saved(Some(&json!("25"))), TimerSettings::default());
    }

    #[test]
    fn knows_when_it_is_done() {
        let timer = TimerSettings::default();
        assert_eq!(timer.done_at(1_000), Some(1_000 + 25 * 60_000));
        let none = TimerSettings { minutes: 0, ..timer };
        assert_eq!(none.done_at(1_000), None);
    }
}
