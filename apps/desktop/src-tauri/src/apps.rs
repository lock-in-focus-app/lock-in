//! App rules: desktop apps a profile closes or hides during its sessions, like Discord, Steam
//! or Slack. They're the app's side of what the extension does for sites, and work without it.

use std::collections::HashSet;
use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::processes::Running;

/// An app a profile keeps away during its sessions. Kept in the profile, so it syncs with the
/// extension, which leaves it alone.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AppRule {
    pub name: String,
    /// The app's executable, which is how it's recognized when it runs.
    pub path: String,
    pub action: AppAction,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum AppAction {
    /// Quit it, as if you'd chosen Quit from its menu.
    Close,
    /// Hide its windows, leaving it running (macOS only).
    Hide,
}

/// The most app rules a profile can have, so a bad sync can't make each check slow.
pub const MAX_RULES: usize = 50;

/// Whether `new` lets anything through that `old` kept away: a rule removed, or a Close
/// turned into a Hide. Not allowed during a Hard session.
pub fn looser(old: &[AppRule], new: &[AppRule]) -> bool {
    old.iter().any(|rule| {
        let kept = new.iter().find(|r| r.path == rule.path);
        match kept {
            None => true,
            Some(kept) => rule.action == AppAction::Close && kept.action == AppAction::Hide,
        }
    })
}

/// What to do about an app that's running during a session.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    /// `first` is true the first time this session, so it's only mentioned once.
    Close {
        pid: u32,
        name: String,
        first: bool,
    },
    Hide {
        pid: u32,
    },
}

/// The apps already closed once this session, by path.
#[derive(Default)]
pub struct AppWatch {
    closed: HashSet<String>,
}

impl AppWatch {
    /// Takes what's running of the profile's apps (and maybe other programs), and returns what
    /// to do now. An app that's opened again is closed or hidden again.
    pub fn check(&mut self, running: &[Running], rules: &[AppRule]) -> Vec<Action> {
        running
            .iter()
            .filter_map(|process| {
                let rule = rules.iter().find(|r| Path::new(&r.path) == process.path)?;
                Some(match rule.action {
                    AppAction::Close => Action::Close {
                        pid: process.pid,
                        name: rule.name.clone(),
                        first: self.closed.insert(rule.path.clone()),
                    },
                    AppAction::Hide => Action::Hide { pid: process.pid },
                })
            })
            .collect()
    }
}

/// An app that can be added to a profile.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct InstalledApp {
    pub name: String,
    pub path: String,
}

/// The apps installed for everyone and for this user, sorted by name.
pub fn installed() -> Vec<InstalledApp> {
    let mut apps = find_installed();
    apps.sort_by_key(|app| app.name.to_lowercase());
    apps.dedup_by(|a, b| a.path == b.path);
    apps
}

/// On macOS, the app bundles in the Applications folders. Each bundle's Info.plist names the
/// executable inside it.
#[cfg(target_os = "macos")]
fn find_installed() -> Vec<InstalledApp> {
    let mut dirs: Vec<std::path::PathBuf> = [
        "/Applications",
        "/Applications/Utilities",
        "/System/Applications",
        "/System/Applications/Utilities",
    ]
    .iter()
    .map(Into::into)
    .collect();
    dirs.extend(dirs::home_dir().map(|home| home.join("Applications")));

    dirs.iter()
        .filter_map(|dir| std::fs::read_dir(dir).ok())
        .flatten()
        .filter_map(|entry| bundle(&entry.ok()?.path()))
        .collect()
}

#[cfg(target_os = "macos")]
fn bundle(path: &Path) -> Option<InstalledApp> {
    let file_name = path.file_name()?.to_str()?;
    let fallback_name = file_name.strip_suffix(".app")?;
    let info = plist::Value::from_file(path.join("Contents/Info.plist")).ok()?;
    let info = info.as_dictionary()?;
    let text = |key: &str| info.get(key).and_then(plist::Value::as_string);
    let executable = path.join("Contents/MacOS").join(text("CFBundleExecutable")?);
    let name = text("CFBundleDisplayName")
        .or_else(|| text("CFBundleName"))
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(fallback_name);
    Some(InstalledApp {
        name: name.to_owned(),
        path: executable.to_string_lossy().into_owned(),
    })
}

/// On Linux, the apps in the menu: desktop entries whose command is a program that can be
/// found. Apps started through a wrapper script (or Flatpak) can't be matched this way yet.
#[cfg(target_os = "linux")]
fn find_installed() -> Vec<InstalledApp> {
    let mut dirs: Vec<std::path::PathBuf> = ["/usr/share/applications", "/usr/local/share/applications"]
        .iter()
        .map(Into::into)
        .collect();
    dirs.extend(dirs::data_dir().map(|data| data.join("applications")));

    dirs.iter()
        .filter_map(|dir| std::fs::read_dir(dir).ok())
        .flatten()
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension()? != "desktop" {
                return None;
            }
            desktop_entry(&std::fs::read_to_string(path).ok()?)
        })
        .collect()
}

/// Reads a desktop entry's name and the program its command runs.
#[cfg(any(target_os = "linux", test))]
fn desktop_entry(text: &str) -> Option<InstalledApp> {
    let mut in_entry = false;
    let (mut name, mut exec, mut hidden) = (None, None, false);
    for line in text.lines().map(str::trim) {
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
            continue;
        }
        let Some((key, value)) = line.split_once('=').filter(|_| in_entry) else {
            continue;
        };
        match key.trim() {
            "Name" => name = name.or(Some(value.trim())),
            "Exec" => exec = exec.or(Some(value.trim())),
            "NoDisplay" | "Hidden" => hidden |= value.trim() == "true",
            "Type" => hidden |= value.trim() != "Application",
            _ => {}
        }
    }
    if hidden {
        return None;
    }
    // The first word that isn't `env` or one of its VAR=value settings.
    let program = exec?
        .split_whitespace()
        .map(|word| word.trim_matches('"'))
        .find(|word| *word != "env" && !word.contains('='))?;
    let path = find_program(program)?;
    Some(InstalledApp {
        name: name?.to_owned(),
        path: path.to_string_lossy().into_owned(),
    })
}

/// The real file a command runs, following links, as the system reports a running program's.
#[cfg(any(target_os = "linux", test))]
fn find_program(program: &str) -> Option<std::path::PathBuf> {
    if program.contains('/') {
        return std::fs::canonicalize(program).ok();
    }
    let paths = std::env::var_os("PATH")?;
    std::env::split_paths(&paths).find_map(|dir| std::fs::canonicalize(dir.join(program)).ok())
}

/// Windows support comes later, with the rest of the Windows version.
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn find_installed() -> Vec<InstalledApp> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(name: &str, action: AppAction) -> AppRule {
        AppRule {
            name: name.into(),
            path: format!("/Applications/{name}.app/Contents/MacOS/{name}"),
            action,
        }
    }

    fn running(pid: u32, rule: &AppRule) -> Running {
        Running {
            pid,
            path: rule.path.clone().into(),
            name: rule.name.clone(),
        }
    }

    #[test]
    fn closes_and_hides_the_apps_on_the_list() {
        let discord = rule("Discord", AppAction::Close);
        let mail = rule("Mail", AppAction::Hide);
        let notes = rule("Notes", AppAction::Close);
        let rules = [discord.clone(), mail.clone()];
        let mut watch = AppWatch::default();

        let actions = watch.check(&[running(1, &discord), running(2, &mail), running(3, &notes)], &rules);
        assert_eq!(
            actions,
            vec![
                Action::Close {
                    pid: 1,
                    name: "Discord".into(),
                    first: true
                },
                Action::Hide { pid: 2 },
            ]
        );

        // Opened again: closed again, without saying so a second time.
        let again = watch.check(&[running(4, &discord)], &rules);
        assert!(matches!(
            again.as_slice(),
            [Action::Close {
                pid: 4,
                first: false,
                ..
            }]
        ));
    }

    #[test]
    fn spots_rules_being_loosened() {
        let close = [rule("Discord", AppAction::Close), rule("Mail", AppAction::Hide)];
        assert!(!looser(&close, &close));
        // Adding a rule, or making one stricter, is fine.
        let more = [
            close[0].clone(),
            rule("Mail", AppAction::Close),
            rule("Steam", AppAction::Close),
        ];
        assert!(!looser(&close, &more));
        // Removing one, or closing less, isn't.
        assert!(looser(&close, &close[..1]));
        assert!(looser(&close, &[rule("Discord", AppAction::Hide), close[1].clone()]));
    }

    #[test]
    fn reads_desktop_entries() {
        let sh = find_program("sh").expect("sh is on the PATH");
        let entry = |text: &str| desktop_entry(text).map(|app| (app.name, app.path));
        let expected = Some(("Shell".to_string(), sh.to_string_lossy().into_owned()));

        assert_eq!(
            entry("[Desktop Entry]\nType=Application\nName=Shell\nExec=sh %U\n"),
            expected
        );
        assert_eq!(
            entry("[Desktop Entry]\nName=Shell\nExec=env A=1 \"sh\" --x\n"),
            expected
        );
        // Only the main entry counts, not its extra actions.
        assert_eq!(
            entry("[Desktop Entry]\nName=Shell\nExec=sh\n[Desktop Action new]\nName=New\nExec=nope\n"),
            expected
        );
        assert_eq!(entry("[Desktop Entry]\nName=Shell\nExec=sh\nNoDisplay=true\n"), None);
        assert_eq!(entry("[Desktop Entry]\nType=Link\nName=Shell\nExec=sh\n"), None);
        assert_eq!(entry("[Desktop Entry]\nName=Gone\nExec=not-a-real-program-xyz\n"), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn finds_installed_apps() {
        // Every Mac has these, with an executable inside each bundle.
        let apps = installed();
        let calculator = apps
            .iter()
            .find(|app| app.path.ends_with("Calculator.app/Contents/MacOS/Calculator"));
        assert!(
            calculator.is_some_and(|app| app.name == "Calculator" && Path::new(&app.path).is_file()),
            "no Calculator among {} apps",
            apps.len()
        );
    }
}
