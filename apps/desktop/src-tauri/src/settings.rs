use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// App-wide settings, as opposed to per-profile ones.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
// `default` fills in any field a saved copy is missing, so new settings can be added later.
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct Settings {
    /// Emergency passes for ending a Hard session early, per 7 days.
    pub passes_per_week: u32,
    /// Minutes without keyboard or mouse input before a session ends by itself. The time away
    /// isn't counted. 0 turns this off.
    pub idle_minutes: u32,
}

pub const MAX_PASSES_PER_WEEK: u32 = 14;
pub const MAX_IDLE_MINUTES: u32 = 120;

impl Default for Settings {
    fn default() -> Self {
        Self {
            passes_per_week: 2,
            idle_minutes: 15,
        }
    }
}

impl Settings {
    /// The same settings with numbers kept in range, for values that come from the UI.
    pub fn clamped(mut self) -> Self {
        self.passes_per_week = self.passes_per_week.min(MAX_PASSES_PER_WEEK);
        self.idle_minutes = self.idle_minutes.min(MAX_IDLE_MINUTES);
        self
    }
}
