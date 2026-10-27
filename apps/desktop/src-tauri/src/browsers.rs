//! Keeping the browsers honest during a session. Each browser with the Lock In extension
//! starts a bridge that links it to the app (link.rs), and that link lasts exactly as long as
//! the extension runs. So a browser that's running without a link during a session has had
//! the extension turned off or removed, and its sites aren't being tamed.
//!
//! What happens then depends on the session's strictness:
//! - Gentle, or no timer running: a warning.
//! - Medium: a warning, then the browser is closed a minute later.
//! - Hard: the same, and the session counts as broken.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::processes::Running;
use crate::timer::Strictness;

/// A browser that has linked to the app, so it's known to have the extension.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct KnownBrowser {
    pub name: String,
    /// The browser's executable, which is how it's recognized when it runs.
    pub path: String,
}

/// How often a running session checks its browsers.
pub const CHECK_EVERY_MS: i64 = 10_000;
/// How long a browser can go without its link before it's a problem. The extension relinks
/// within a few seconds when it reloads or updates, or when the app or browser starts.
const GRACE_MS: i64 = 20_000;
/// How long after the warning a browser is closed.
const CLOSE_AFTER_MS: i64 = 60_000;

/// What to do about a browser running without the extension.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    Warn { name: String, response: Response },
    Close { pid: u32, name: String, breaks: bool },
}

/// How far a session goes when a browser runs without the extension.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Response {
    Warn,
    Close,
    CloseAndBreak,
}

impl Response {
    /// The response for a session's strictness while its timer is running (`Session::lock`).
    pub fn to(lock: Option<Strictness>) -> Self {
        match lock {
            None | Some(Strictness::Gentle) => Response::Warn,
            Some(Strictness::Medium) => Response::Close,
            Some(Strictness::Hard) => Response::CloseAndBreak,
        }
    }
}

/// When a browser was first seen without its link, and when it was last warned or closed.
struct Quiet {
    since: i64,
    acted_at: Option<i64>,
}

/// The browsers seen running without their link this session, by process id.
#[derive(Default)]
pub struct BrowserWatch {
    quiet: HashMap<u32, Quiet>,
}

impl BrowserWatch {
    /// Takes the known browsers that are running and the process ids of the browsers that are
    /// linked, and returns what to do now.
    pub fn check(
        &mut self,
        now: i64,
        running: &[Running],
        linked: &HashSet<u32>,
        lock: Option<Strictness>,
    ) -> Vec<Action> {
        let response = Response::to(lock);
        let unlinked: Vec<&Running> = running.iter().filter(|b| !linked.contains(&b.pid)).collect();
        // A browser that linked again, or quit, starts over.
        self.quiet.retain(|pid, _| unlinked.iter().any(|b| b.pid == *pid));

        let mut actions = Vec::new();
        for browser in unlinked {
            let quiet = self.quiet.entry(browser.pid).or_insert(Quiet {
                since: now,
                acted_at: None,
            });
            match quiet.acted_at {
                None if now - quiet.since >= GRACE_MS => {
                    quiet.acted_at = Some(now);
                    actions.push(Action::Warn {
                        name: browser.name.clone(),
                        response,
                    });
                }
                // If it's still running a minute after being asked to quit, it's asked again.
                Some(at) if response != Response::Warn && now - at >= CLOSE_AFTER_MS => {
                    quiet.acted_at = Some(now);
                    actions.push(Action::Close {
                        pid: browser.pid,
                        name: browser.name.clone(),
                        breaks: response == Response::CloseAndBreak,
                    });
                }
                _ => {}
            }
        }
        actions
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SEC: i64 = 1_000;

    fn chrome() -> Running {
        Running {
            pid: 7,
            path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into(),
            name: "Google Chrome".into(),
        }
    }

    fn linked(pids: &[u32]) -> HashSet<u32> {
        pids.iter().copied().collect()
    }

    /// Checks every 10 seconds from 0 to `until`, and returns each action with when it happened.
    fn run(
        watch: &mut BrowserWatch,
        until: i64,
        linked: &HashSet<u32>,
        lock: Option<Strictness>,
    ) -> Vec<(i64, Action)> {
        (0..=until / CHECK_EVERY_MS)
            .map(|i| i * CHECK_EVERY_MS)
            .flat_map(|now| {
                watch
                    .check(now, &[chrome()], linked, lock)
                    .into_iter()
                    .map(move |a| (now, a))
            })
            .collect()
    }

    #[test]
    fn leaves_linked_browsers_alone() {
        let mut watch = BrowserWatch::default();
        assert_eq!(
            run(&mut watch, 300 * SEC, &linked(&[7]), Some(Strictness::Hard)),
            vec![]
        );
    }

    #[test]
    fn gentle_only_warns() {
        let mut watch = BrowserWatch::default();
        let actions = run(&mut watch, 300 * SEC, &linked(&[]), Some(Strictness::Gentle));
        assert_eq!(
            actions,
            vec![(
                20 * SEC,
                Action::Warn {
                    name: "Google Chrome".into(),
                    response: Response::Warn
                }
            )]
        );
        // So does a session with no timer running.
        let mut watch = BrowserWatch::default();
        assert_eq!(run(&mut watch, 300 * SEC, &linked(&[]), None).len(), 1);
    }

    #[test]
    fn medium_closes_the_browser_a_minute_after_warning() {
        let mut watch = BrowserWatch::default();
        let actions = run(&mut watch, 90 * SEC, &linked(&[]), Some(Strictness::Medium));
        assert_eq!(
            actions,
            vec![
                (
                    20 * SEC,
                    Action::Warn {
                        name: "Google Chrome".into(),
                        response: Response::Close
                    }
                ),
                (
                    80 * SEC,
                    Action::Close {
                        pid: 7,
                        name: "Google Chrome".into(),
                        breaks: false
                    }
                ),
            ]
        );
    }

    #[test]
    fn hard_also_breaks_the_session() {
        let mut watch = BrowserWatch::default();
        let actions = run(&mut watch, 90 * SEC, &linked(&[]), Some(Strictness::Hard));
        assert!(matches!(actions.last(), Some((_, Action::Close { breaks: true, .. }))));
    }

    #[test]
    fn linking_again_in_time_starts_over() {
        let mut watch = BrowserWatch::default();
        let none = linked(&[]);
        let lock = Some(Strictness::Medium);
        assert_eq!(watch.check(0, &[chrome()], &none, lock), vec![]);
        assert_eq!(watch.check(20 * SEC, &[chrome()], &none, lock).len(), 1);
        // The extension is turned back on before the browser closes.
        assert_eq!(watch.check(30 * SEC, &[chrome()], &linked(&[7]), lock), vec![]);
        // Turned off again later: a fresh warning, not an instant close.
        assert_eq!(watch.check(100 * SEC, &[chrome()], &none, lock), vec![]);
        assert!(matches!(
            watch.check(120 * SEC, &[chrome()], &none, lock).as_slice(),
            [Action::Warn { .. }]
        ));
    }

    #[test]
    fn does_not_close_once_the_timer_is_done() {
        let mut watch = BrowserWatch::default();
        let none = linked(&[]);
        watch.check(0, &[chrome()], &none, Some(Strictness::Hard));
        assert_eq!(
            watch.check(20 * SEC, &[chrome()], &none, Some(Strictness::Hard)).len(),
            1
        );
        // The timer runs out before the minute is up, so ending is free and nothing closes.
        assert_eq!(watch.check(90 * SEC, &[chrome()], &none, None), vec![]);
    }
}
