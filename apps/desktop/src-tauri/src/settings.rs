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
}

pub const MAX_PASSES_PER_WEEK: u32 = 14;

impl Default for Settings {
    fn default() -> Self {
        Self { passes_per_week: 2 }
    }
}

impl Settings {
    /// The same settings with numbers kept in range, for values that come from the UI.
    pub fn clamped(mut self) -> Self {
        self.passes_per_week = self.passes_per_week.min(MAX_PASSES_PER_WEEK);
        self
    }
}
