//! Finding and closing other programs, by the file they were started from. Lock In only ever
//! looks for browsers that have linked to it, and only closes one during a session.

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

/// Asks a program to quit, as the system does when it shuts down, so it can save its tabs.
/// Returns whether the request was sent.
pub fn quit(pid: u32) -> bool {
    let pid = Pid::from_u32(pid);
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind());
    system
        .process(pid)
        .and_then(|process| process.kill_with(Signal::Term))
        .unwrap_or(false)
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

    #[test]
    fn finds_this_process() {
        let me = find(std::process::id()).expect("this test is running");
        assert_eq!(me.path, std::env::current_exe().unwrap());
        // A test runs as one process, so it's its own main process.
        let found = running(std::slice::from_ref(&me.path));
        assert!(found.iter().any(|p| p.pid == me.pid));
    }
}
