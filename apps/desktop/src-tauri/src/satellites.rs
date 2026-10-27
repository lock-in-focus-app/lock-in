use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::session::truncate;

/// The longest satellite kept. The box limits it too; this is a backstop.
pub const MAX_TEXT: usize = 500;

/// A thought launched to come back later, so it doesn't pull you out of the session.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Satellite {
    pub id: String,
    pub text: String,
    /// Epoch milliseconds.
    pub launched_at: i64,
    pub state: SatelliteState,
}

/// Where a satellite is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum SatelliteState {
    /// Waiting to come back when the running session ends, or the next one if none is running.
    Orbiting,
    /// Came back when a session ended, and waits for you to say what to do with it.
    Back,
    /// On the task list.
    Task,
    /// Ticked off.
    Done,
    /// Deleted. Its text is gone; it's only kept so insights can count it.
    Deleted,
}

impl SatelliteState {
    pub fn as_str(self) -> &'static str {
        match self {
            SatelliteState::Orbiting => "orbiting",
            SatelliteState::Back => "back",
            SatelliteState::Task => "task",
            SatelliteState::Done => "done",
            SatelliteState::Deleted => "deleted",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "orbiting" => Some(SatelliteState::Orbiting),
            "back" => Some(SatelliteState::Back),
            "task" => Some(SatelliteState::Task),
            "done" => Some(SatelliteState::Done),
            "deleted" => Some(SatelliteState::Deleted),
            _ => None,
        }
    }

    /// Whether it's still shown: in orbit, back, or on the task list.
    pub fn is_live(self) -> bool {
        !matches!(self, SatelliteState::Done | SatelliteState::Deleted)
    }
}

/// What to do with a satellite, from the return checklist or the task list.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum SatelliteAction {
    Done,
    /// Back into orbit, to come back when the next session ends.
    Snooze,
    /// Onto the task list.
    Task,
    Delete,
}

impl SatelliteAction {
    /// Where the satellite ends up.
    pub fn state(self) -> SatelliteState {
        match self {
            SatelliteAction::Done => SatelliteState::Done,
            SatelliteAction::Snooze => SatelliteState::Orbiting,
            SatelliteAction::Task => SatelliteState::Task,
            SatelliteAction::Delete => SatelliteState::Deleted,
        }
    }
}

/// The text worth keeping from what was typed: trimmed and cut down to a sensible length, or
/// None if there's nothing there.
pub fn cleaned(text: &str) -> Option<String> {
    let mut text = text.trim().to_owned();
    truncate(&mut text, MAX_TEXT);
    let text = text.trim_end().to_owned();
    (!text.is_empty()).then_some(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_text() {
        assert_eq!(cleaned("  call mum \n"), Some("call mum".into()));
        assert_eq!(cleaned(" \n\t "), None);
        let long = "é".repeat(MAX_TEXT + 10);
        assert_eq!(cleaned(&long).unwrap().chars().count(), MAX_TEXT);
    }

    #[test]
    fn states_round_trip() {
        for state in [
            SatelliteState::Orbiting,
            SatelliteState::Back,
            SatelliteState::Task,
            SatelliteState::Done,
            SatelliteState::Deleted,
        ] {
            assert_eq!(SatelliteState::parse(state.as_str()), Some(state));
        }
    }
}
