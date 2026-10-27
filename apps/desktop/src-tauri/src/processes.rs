//! Finding, closing and hiding other programs, by the file they were started from. Lock In
//! only looks for browsers that have linked to it and the apps in a session's app rules, and
//! only closes or hides them during a session.

use std::path::{Path, PathBuf};

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, Signal, System, UpdateKind};

/// A running program.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Running {
    pub pid: u32,
    /// The executable it was started from.
    pub path: PathBuf,
    /// What people call it, e.g. "Google Chrome".
    pub name: String,
}

/// What's needed of each process: only the file it was started from (and its parent, which
/// always comes along). Reading less keeps each check quick.
fn refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet)
}

/// The process with this id, if it's still running.
pub fn find(pid: u32) -> Option<Running> {
    let pid = Pid::from_u32(pid);
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind());
    let path = system.process(pid)?.exe()?.to_path_buf();
    Some(Running {
        pid: pid.as_u32(),
        name: display_name(&path),
        path,
    })
}

/// The running programs started from any of these files. A browser runs as many processes,
/// so only the main one counts: the one whose parent isn't the same program.
pub fn running(paths: &[PathBuf]) -> Vec<Running> {
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind());
    let exe = |pid: Pid| system.process(pid).and_then(|p| p.exe());
    system
        .processes()
        .iter()
        .filter_map(|(&pid, process)| {
            let path = process.exe()?;
            let wanted = paths.iter().any(|p| p == path);
            let main = process.parent().and_then(exe) != Some(path);
            (wanted && main).then(|| Running {
                pid: pid.as_u32(),
                path: path.to_path_buf(),
                name: display_name(path),
            })
        })
        .collect()
}

/// Asks a program to quit, so it can save its work (and a browser its tabs) first. On macOS
/// that's the same as choosing Quit from its menu; elsewhere, and for macOS programs that
/// aren't apps, it's the signal the system sends at shutdown. Returns whether it was asked.
pub fn quit(pid: u32) -> bool {
    #[cfg(target_os = "macos")]
    if let Some(asked) = with_app(pid, |app| app.terminate()) {
        return asked;
    }
    let pid = Pid::from_u32(pid);
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind());
    system
        .process(pid)
        .and_then(|process| process.kill_with(Signal::Term))
        .unwrap_or(false)
}

/// Hides an app's windows, as if you'd pressed ⌘H in it. Returns whether it's hidden or was
/// asked to hide. Only macOS has a way to do this for any app.
pub fn hide(pid: u32) -> bool {
    #[cfg(target_os = "macos")]
    return with_app(pid, |app| app.isHidden() || app.hide()).unwrap_or(false);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pid;
        false
    }
}

/// Runs `f` with the app that has this process id, or returns None if it isn't an app.
#[cfg(target_os = "macos")]
fn with_app<T>(pid: u32, f: impl FnOnce(&objc2_app_kit::NSRunningApplication) -> T) -> Option<T> {
    let pid = i32::try_from(pid).ok()?;
    objc2_app_kit::NSRunningApplication::runningApplicationWithProcessIdentifier(pid).map(|app| f(&app))
}

/// "Google Chrome" for /Applications/Google Chrome.app/Contents/MacOS/Google Chrome, and
/// "Firefox" for /usr/lib/firefox/firefox.
fn display_name(path: &Path) -> String {
    let app = path
        .ancestors()
        .filter_map(|dir| dir.file_name()?.to_str()?.strip_suffix(".app"))
        .next();
    let name = app.or_else(|| path.file_stem()?.to_str()).unwrap_or("A browser");
    let mut chars = name.chars();
    chars
        .next()
        .map_or_else(String::new, |first| first.to_uppercase().chain(chars).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_programs_as_people_know_them() {
        let name = |path: &str| display_name(Path::new(path));
        assert_eq!(
            name("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            "Google Chrome"
        );
        assert_eq!(name("/Applications/Firefox.app/Contents/MacOS/firefox"), "Firefox");
        assert_eq!(name("/usr/lib/firefox/firefox"), "Firefox");
        assert_eq!(name("/opt/brave.com/brave/brave"), "Brave");
    }

    #[cfg(unix)]
    #[test]
    fn finds_and_quits_a_program() {
        let mut child = std::process::Command::new("sleep").arg("30").spawn().unwrap();
        let path = find(child.id()).expect("sleep is running").path;
        assert!(running(std::slice::from_ref(&path)).iter().any(|p| p.pid == child.id()));

        assert!(quit(child.id()));
        use std::os::unix::process::ExitStatusExt;
        assert_eq!(child.wait().unwrap().signal(), Some(15));
    }

    /// Opens Calculator in the background, then hides and quits it the way app rules do. It
    /// touches a real app, so it only runs when asked: `cargo test -- --ignored`.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore]
    fn hides_and_quits_a_real_app() {
        let path = PathBuf::from("/System/Applications/Calculator.app/Contents/MacOS/Calculator");
        let opened = std::process::Command::new("open")
            .args(["-g", "-a", "Calculator"])
            .status();
        assert!(opened.unwrap().success());
        let calculator = (0..50)
            .find_map(|_| {
                std::thread::sleep(std::time::Duration::from_millis(100));
                running(std::slice::from_ref(&path)).pop()
            })
            .expect("Calculator opened");

        // An app that's still launching can't be hidden yet; the session's next check would try again.
        let hidden = (0..50).any(|_| {
            std::thread::sleep(std::time::Duration::from_millis(100));
            hide(calculator.pid)
        });
        assert!(hidden, "Calculator wasn't hidden");
        assert!(quit(calculator.pid));
        let gone = (0..50).any(|_| {
            std::thread::sleep(std::time::Duration::from_millis(100));
            find(calculator.pid).is_none()
        });
        assert!(gone, "Calculator didn't quit");
    }

    #[test]
    fn finds_this_process() {
        let me = find(std::process::id()).expect("this test is running");
        assert_eq!(me.path, std::env::current_exe().unwrap());
        // A test runs as one process, so it's its own main process.
        let found = running(std::slice::from_ref(&me.path));
        assert!(found.iter().any(|p| p.pid == me.pid));
    }
}
