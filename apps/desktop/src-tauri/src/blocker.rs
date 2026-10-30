//! Blocking sites without the browser extension, for people who just want sites shut. While a
//! session runs, its profile's restricted sites are listed in the computer's hosts file
//! (/etc/hosts), which every browser and app checks before looking a site up, so none of them
//! can reach those sites. Only whole sites: taming, page rules and the redirect page need the
//! extension.
//!
//! Changing that file needs an administrator, so a tiny helper does it: this same program, run
//! by the system (launchd) as root with `--blocker`. It's installed only when someone turns the
//! setting on, when macOS asks for their password once, and it can be removed again from
//! Settings. It only ever writes Lock In's own marked part of the file, from site names it
//! checks itself. It listens on a local socket that only the person who installed it can use,
//! and if the app stops checking in for a few minutes (it quit, crashed or was deleted), it
//! unblocks everything by itself, so a site is never left blocked by mistake.
//!
//! macOS only for now (PLAN §8).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::session::Profile;
use crate::sites::SiteLevel;

/// The helper's name with launchd, and the name of its files.
pub const LABEL: &str = "io.github.lock-in-focus-app.blocker";

/// Bumped when the helper changes, so Settings can offer to update an older one.
pub const VERSION: u32 = 1;

/// How long a block lasts without the app checking in, and how often it checks in.
pub const LEASE_SECS: u64 = 300;
pub const CHECK_IN_SECS: u64 = 60;

/// The most names the helper writes, so a bad request can't make the file huge.
const MAX_HOSTNAMES: usize = 2000;

/// What the app asks the helper, one JSON line at a time.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Request {
    /// Just says hello back, with its version.
    Hello,
    /// Blocks exactly these names (and unblocks any others). Empty unblocks everything.
    Block { hostnames: Vec<String> },
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Response {
    pub ok: bool,
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Whether the helper is there, running, and the same version as the app, for Settings.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BlockerStatus {
    /// Whether this computer can block without the extension (macOS only for now).
    pub supported: bool,
    pub installed: bool,
    pub running: bool,
    /// False when an older helper is installed and should be updated.
    pub up_to_date: bool,
}

/// The built-in sites' recipes, for their addresses. A test checks every recipe is listed.
const RECIPES: [&str; 8] = [
    include_str!("../../../../packages/recipes/src/facebook.json"),
    include_str!("../../../../packages/recipes/src/instagram.json"),
    include_str!("../../../../packages/recipes/src/linkedin.json"),
    include_str!("../../../../packages/recipes/src/pinterest.json"),
    include_str!("../../../../packages/recipes/src/reddit.json"),
    include_str!("../../../../packages/recipes/src/tiktok.json"),
    include_str!("../../../../packages/recipes/src/x.json"),
    include_str!("../../../../packages/recipes/src/youtube.json"),
];

#[derive(Deserialize)]
struct RecipeMatches {
    id: String,
    matches: Vec<String>,
}

/// The addresses of a built-in site, from its recipe's match patterns: "*://*.reddit.com/*"
/// is reddit.com.
fn recipe_domains(recipe_id: &str) -> Vec<String> {
    RECIPES
        .iter()
        .filter_map(|json| serde_json::from_str::<RecipeMatches>(json).ok())
        .filter(|recipe| recipe.id == recipe_id)
        .flat_map(|recipe| recipe.matches)
        .filter_map(|pattern| {
            let host = pattern.split("://").nth(1)?.split('/').next()?;
            let domain = host.strip_prefix("*.").unwrap_or(host);
            valid_hostname(domain).then(|| domain.to_owned())
        })
        .collect()
}

/// The sites a profile restricts, by address: built-in ones from their recipes, and ones added
/// by address ("site:example.com") as they are. Page rules can't be blocked this way, since the
/// hosts file only knows whole sites.
pub fn restricted_domains(profile: &Profile) -> Vec<String> {
    let mut domains: Vec<String> = profile
        .sites()
        .into_iter()
        .filter(|site| site.level == SiteLevel::Restricted)
        .flat_map(|site| match site.recipe_id.strip_prefix("site:") {
            Some(domain) => vec![domain.to_owned()],
            None => recipe_domains(&site.recipe_id),
        })
        .filter(|domain| valid_hostname(domain))
        .collect();
    domains.sort();
    domains.dedup();
    domains
}

/// The names to block for some sites. The hosts file has no wildcards, so each site's usual
/// names are listed: the site itself, www. and m. (its mobile site).
pub fn hostnames_for(domains: &[String]) -> Vec<String> {
    let mut names: Vec<String> = domains
        .iter()
        .flat_map(|domain| [domain.clone(), format!("www.{domain}"), format!("m.{domain}")])
        .filter(|name| valid_hostname(name))
        .collect();
    names.sort();
    names.dedup();
    names.truncate(MAX_HOSTNAMES);
    names
}

/// A site's name: two or more labels of letters, digits and hyphens, not an IP address.
/// Anything else is never written, whoever asks.
pub fn valid_hostname(name: &str) -> bool {
    let labels: Vec<&str> = name.split('.').collect();
    let label_ok = |label: &&str| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    };
    name.len() <= 253
        && labels.len() >= 2
        && labels.iter().all(label_ok)
        && !labels.last().is_some_and(|tld| tld.bytes().all(|b| b.is_ascii_digit()))
}

const BEGIN: &str = "# >>> Lock In: sites blocked during a focus session. Removed when it ends.";
const END: &str = "# <<< Lock In";

/// The hosts file with Lock In's part set to block these names, or taken out if there are none.
/// Everything else in the file is kept as it was.
pub fn with_section(hosts: &str, hostnames: &[String]) -> String {
    if !hosts.contains("# >>> Lock In") && !hostnames.iter().any(|name| valid_hostname(name)) {
        return hosts.to_owned();
    }
    let mut kept: Vec<&str> = Vec::new();
    let mut inside = false;
    let lines: Vec<&str> = hosts.lines().collect();
    for (i, line) in lines.iter().enumerate() {
        if line.starts_with("# >>> Lock In") {
            // Only a section that's closed is taken out, so nothing else is ever lost.
            inside = lines[i + 1..].iter().any(|later| later.starts_with(END));
            continue;
        }
        if inside {
            if line.starts_with(END) {
                inside = false;
            }
            continue;
        }
        kept.push(line);
    }
    while kept.last().is_some_and(|line| line.trim().is_empty()) {
        kept.pop();
    }

    let mut out = kept.join("\n");
    if !out.is_empty() {
        out.push('\n');
    }
    let names: Vec<&String> = hostnames.iter().filter(|name| valid_hostname(name)).collect();
    if !names.is_empty() {
        out.push('\n');
        out.push_str(BEGIN);
        out.push('\n');
        for name in names {
            out.push_str(&format!("0.0.0.0 {name}\n:: {name}\n"));
        }
        out.push_str(END);
        out.push('\n');
    }
    out
}

#[cfg(target_os = "macos")]
pub use mac::{clean, install, remove, run_helper, send, status};

#[cfg(not(target_os = "macos"))]
pub fn status() -> BlockerStatus {
    BlockerStatus {
        supported: false,
        installed: false,
        running: false,
        up_to_date: false,
    }
}

#[cfg(not(target_os = "macos"))]
pub fn send(_request: &Request) -> std::io::Result<Response> {
    Err(std::io::Error::other(
        "blocking without the extension is macOS only for now",
    ))
}

#[cfg(target_os = "macos")]
mod mac {
    use std::io::{BufRead, BufReader, Read, Write};
    use std::os::fd::AsRawFd;
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::{UnixListener, UnixStream};
    use std::path::Path;
    use std::process::Command;
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    use super::*;

    const HOSTS: &str = "/etc/hosts";
    const SOCKET: &str = "/var/run/io.github.lock-in-focus-app.blocker.sock";

    fn helper_path() -> String {
        format!("/Library/PrivilegedHelperTools/{LABEL}")
    }

    fn plist_path() -> String {
        format!("/Library/LaunchDaemons/{LABEL}.plist")
    }

    // ----- The helper, running as root -----

    /// Runs the helper: `--blocker --uid <uid>` serves the person who installed it, and
    /// `--blocker-clean` just takes Lock In's part out of the hosts file (when it's removed).
    pub fn run_helper(args: &[String]) -> i32 {
        if args.iter().any(|arg| arg == "--blocker-clean") {
            return match apply(&[]) {
                Ok(()) => 0,
                Err(error) => {
                    eprintln!("Lock In helper: {error}");
                    1
                }
            };
        }
        let uid = args
            .iter()
            .position(|arg| arg == "--uid")
            .and_then(|i| args.get(i + 1))
            .and_then(|uid| uid.parse::<u32>().ok());
        let Some(uid) = uid else {
            eprintln!("Lock In helper: started without --uid");
            return 2;
        };
        match serve(uid) {
            Ok(()) => 0,
            Err(error) => {
                eprintln!("Lock In helper: {error}");
                1
            }
        }
    }

    fn serve(uid: u32) -> std::io::Result<()> {
        // Whatever was blocked before a restart is unblocked; the app sends it again if a
        // session is still running.
        apply(&[])?;

        let _ = std::fs::remove_file(SOCKET);
        let listener = UnixListener::bind(SOCKET)?;
        // Anyone may connect, but only the person who installed it is listened to (below).
        std::fs::set_permissions(SOCKET, std::fs::Permissions::from_mode(0o666))?;

        let lease: Arc<Mutex<Option<Instant>>> = Arc::default();
        let watched = Arc::clone(&lease);
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_secs(15));
                let mut until = watched.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
                if until.is_some_and(|until| Instant::now() >= until) {
                    *until = None;
                    if let Err(error) = apply(&[]) {
                        eprintln!("Lock In helper: couldn't unblock after the app went quiet: {error}");
                    }
                }
            }
        });

        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            if let Err(error) = answer(stream, uid, &lease) {
                eprintln!("Lock In helper: {error}");
            }
        }
        Ok(())
    }

    /// Answers one request, if it comes from the person who installed the helper (or root).
    fn answer(stream: UnixStream, uid: u32, lease: &Mutex<Option<Instant>>) -> std::io::Result<()> {
        stream.set_read_timeout(Some(Duration::from_secs(5)))?;
        let from = peer_uid(&stream)?;
        if from != uid && from != 0 {
            return Err(std::io::Error::other(format!("ignored a request from user {from}")));
        }

        let mut line = String::new();
        BufReader::new((&stream).take(256 * 1024)).read_line(&mut line)?;
        let response = match serde_json::from_str::<Request>(&line) {
            Ok(Request::Hello) => Response {
                ok: true,
                version: VERSION,
                error: None,
            },
            Ok(Request::Block { hostnames }) => {
                let names: Vec<String> = hostnames
                    .into_iter()
                    .filter(|name| valid_hostname(name))
                    .take(MAX_HOSTNAMES)
                    .collect();
                let mut until = lease.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
                *until = (!names.is_empty()).then(|| Instant::now() + Duration::from_secs(LEASE_SECS));
                let result = apply(&names);
                Response {
                    ok: result.is_ok(),
                    version: VERSION,
                    error: result.err().map(|error| error.to_string()),
                }
            }
            Err(error) => Response {
                ok: false,
                version: VERSION,
                error: Some(format!("couldn't read the request: {error}")),
            },
        };
        let mut out = serde_json::to_string(&response).map_err(std::io::Error::other)?;
        out.push('\n');
        (&stream).write_all(out.as_bytes())
    }

    /// Who's on the other end of the socket, as the system knows it.
    fn peer_uid(stream: &UnixStream) -> std::io::Result<u32> {
        let mut uid: libc::uid_t = 0;
        let mut gid: libc::gid_t = 0;
        // Safety: getpeereid only writes the two ids, through pointers to locals that outlive it.
        let result = unsafe { libc::getpeereid(stream.as_raw_fd(), &mut uid, &mut gid) };
        if result == 0 {
            Ok(uid)
        } else {
            Err(std::io::Error::last_os_error())
        }
    }

    /// Writes Lock In's part of the hosts file, if it changed, then has macOS forget the
    /// addresses it remembered so the change applies straight away.
    fn apply(hostnames: &[String]) -> std::io::Result<()> {
        let before = std::fs::read_to_string(HOSTS)?;
        let after = with_section(&before, hostnames);
        if after == before {
            return Ok(());
        }
        // Written beside it and moved over it, so the file is never half written.
        let temporary = format!("{HOSTS}.lock-in");
        std::fs::write(&temporary, &after)?;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o644))?;
        std::fs::rename(&temporary, HOSTS)?;
        let _ = Command::new("/usr/bin/dscacheutil").arg("-flushcache").status();
        let _ = Command::new("/usr/bin/killall")
            .args(["-HUP", "mDNSResponder"])
            .status();
        Ok(())
    }

    // ----- The app's side -----

    /// Sends the helper a request and waits briefly for its answer.
    pub fn send(request: &Request) -> std::io::Result<Response> {
        let stream = UnixStream::connect(SOCKET)?;
        stream.set_read_timeout(Some(Duration::from_secs(5)))?;
        stream.set_write_timeout(Some(Duration::from_secs(5)))?;
        let mut line = serde_json::to_string(request).map_err(std::io::Error::other)?;
        line.push('\n');
        (&stream).write_all(line.as_bytes())?;
        let mut answer = String::new();
        BufReader::new((&stream).take(64 * 1024)).read_line(&mut answer)?;
        serde_json::from_str(&answer).map_err(std::io::Error::other)
    }

    pub fn status() -> BlockerStatus {
        let installed = Path::new(&plist_path()).exists();
        let hello = send(&Request::Hello).ok();
        BlockerStatus {
            supported: true,
            installed,
            running: hello.is_some(),
            up_to_date: hello.is_some_and(|hello| hello.version == VERSION),
        }
    }

    /// Takes Lock In's part out of the hosts file straight away, e.g. when the setting is
    /// turned off.
    pub fn clean() -> std::io::Result<()> {
        send(&Request::Block { hostnames: vec![] }).map(|_| ())
    }

    /// Installs (or updates) the helper: copies this program to where only root can change it
    /// and has launchd run it. macOS asks for an administrator's password first, in its own
    /// dialog; Lock In never sees it.
    pub fn install() -> Result<(), String> {
        let executable = std::env::current_exe()
            .and_then(std::fs::canonicalize)
            .map_err(|error| format!("couldn't find Lock In itself: {error}"))?;
        let executable = executable.to_str().ok_or("Lock In's location has unusual characters")?;
        // Safety: getuid just returns the current user's id.
        let uid = unsafe { libc::getuid() };
        run_as_admin(&install_script(executable, uid))
    }

    /// Removes the helper and anything it blocked. Asks for the password again.
    pub fn remove() -> Result<(), String> {
        run_as_admin(&remove_script())
    }

    pub(super) fn install_script(executable: &str, uid: u32) -> String {
        let helper = helper_path();
        let plist = plist_path();
        let launchd = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>{LABEL}</string><key>ProgramArguments</key><array><string>{helper}</string><string>--blocker</string><string>--uid</string><string>{uid}</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>"#
        );
        [
            "/bin/mkdir -p /Library/PrivilegedHelperTools".to_owned(),
            format!(
                "/bin/cp {} {}",
                sh_quote(executable),
                sh_quote(&format!("{helper}.new"))
            ),
            format!("/usr/sbin/chown root:wheel {}", sh_quote(&format!("{helper}.new"))),
            format!("/bin/chmod 755 {}", sh_quote(&format!("{helper}.new"))),
            format!(
                "/bin/mv -f {} {}",
                sh_quote(&format!("{helper}.new")),
                sh_quote(&helper)
            ),
            format!("/usr/bin/printf '%s' {} > {}", sh_quote(&launchd), sh_quote(&plist)),
            format!("/usr/sbin/chown root:wheel {}", sh_quote(&plist)),
            format!("/bin/chmod 644 {}", sh_quote(&plist)),
            format!("(/bin/launchctl bootout system/{LABEL} 2>/dev/null; /bin/sleep 1; true)"),
            format!("/bin/launchctl bootstrap system {}", sh_quote(&plist)),
        ]
        .join(" && ")
    }

    pub(super) fn remove_script() -> String {
        let helper = helper_path();
        [
            format!("(/bin/launchctl bootout system/{LABEL} 2>/dev/null; true)"),
            format!("({} --blocker-clean; true)", sh_quote(&helper)),
            format!(
                "/bin/rm -f {} {} {}",
                sh_quote(&plist_path()),
                sh_quote(&helper),
                sh_quote(SOCKET)
            ),
        ]
        .join(" && ")
    }

    /// Runs a shell script as root, after macOS asks for an administrator's password.
    fn run_as_admin(script: &str) -> Result<(), String> {
        let applescript = format!(
            "do shell script \"{}\" with administrator privileges with prompt \"Lock In needs your OK to block sites without the browser extension.\"",
            applescript_quote(script)
        );
        let output = Command::new("/usr/bin/osascript")
            .args(["-e", &applescript])
            .output()
            .map_err(|error| error.to_string())?;
        if output.status.success() {
            return Ok(());
        }
        let message = String::from_utf8_lossy(&output.stderr);
        // -128 is Cancel in the password dialog.
        Err(if message.contains("-128") {
            "canceled".to_owned()
        } else {
            message.trim().to_owned()
        })
    }

    /// A string as one shell word, in single quotes.
    pub(super) fn sh_quote(text: &str) -> String {
        format!("'{}'", text.replace('\'', r"'\''"))
    }

    /// A string inside an AppleScript string literal.
    pub(super) fn applescript_quote(text: &str) -> String {
        text.replace('\\', r"\\").replace('"', "\\\"")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sites::SiteRule;

    fn profile(sites: &[(&str, SiteLevel)]) -> Profile {
        let sites: Vec<SiteRule> = sites
            .iter()
            .map(|&(id, level)| SiteRule {
                recipe_id: id.into(),
                level,
                toggles: None,
                paths: None,
            })
            .collect();
        let mut profile: Profile = serde_json::from_str(r#"{"id":"p","name":"P"}"#).unwrap();
        profile.set_sites(&sites);
        profile
    }

    #[test]
    fn every_recipe_is_listed_and_has_addresses() {
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../packages/recipes/src");
        let files = std::fs::read_dir(dir)
            .unwrap()
            .filter(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .path()
                    .extension()
                    .is_some_and(|ext| ext == "json")
            })
            .count();
        assert_eq!(files, RECIPES.len(), "add the new recipe to RECIPES");
        for json in RECIPES {
            let recipe: RecipeMatches = serde_json::from_str(json).unwrap();
            assert!(!recipe_domains(&recipe.id).is_empty(), "{} has no addresses", recipe.id);
        }
        assert_eq!(recipe_domains("x"), ["x.com", "twitter.com"]);
    }

    #[test]
    fn blocks_only_restricted_sites() {
        let profile = profile(&[
            ("reddit", SiteLevel::Restricted),
            ("youtube", SiteLevel::Redirected),
            ("site:news.ycombinator.com", SiteLevel::Restricted),
            ("site:example.com", SiteLevel::Tamed),
            ("site:not a site", SiteLevel::Restricted),
        ]);
        assert_eq!(restricted_domains(&profile), ["news.ycombinator.com", "reddit.com"]);
        assert_eq!(
            hostnames_for(&restricted_domains(&profile)),
            [
                "m.news.ycombinator.com",
                "m.reddit.com",
                "news.ycombinator.com",
                "reddit.com",
                "www.news.ycombinator.com",
                "www.reddit.com",
            ]
        );
    }

    #[test]
    fn checks_names_before_writing_them() {
        for good in ["reddit.com", "a-b.co.uk", "x.com"] {
            assert!(valid_hostname(good), "{good}");
        }
        for bad in [
            "",
            "localhost",
            "127.0.0.1",
            "reddit.com\n0.0.0.0 apple.com",
            "-bad.com",
            "UPPER.com",
            "a..b",
            "evil.com # comment",
        ] {
            assert!(!valid_hostname(bad), "{bad:?}");
        }
    }

    #[test]
    fn writes_only_its_own_part_of_the_hosts_file() {
        let original = "127.0.0.1 localhost\n::1 localhost\n# a comment of yours\n";
        let names = vec!["reddit.com".to_owned(), "bad name".to_owned()];

        let blocked = with_section(original, &names);
        assert!(blocked.starts_with(original));
        assert!(blocked.contains("0.0.0.0 reddit.com\n:: reddit.com\n"));
        assert!(!blocked.contains("bad name"));
        // Blocking again replaces the part rather than adding another.
        let again = with_section(&blocked, &["x.com".to_owned()]);
        assert_eq!(again.matches("# >>> Lock In").count(), 1);
        assert!(!again.contains("reddit.com"));
        // Unblocking gives back the file as it was.
        assert_eq!(with_section(&again, &[]), original);
        assert_eq!(with_section(original, &[]), original);
    }

    #[test]
    fn never_drops_lines_after_a_section_that_was_never_closed() {
        let broken = "127.0.0.1 localhost\n# >>> Lock In: half written\n10.0.0.1 nas.local\n";
        assert_eq!(with_section(broken, &[]), "127.0.0.1 localhost\n10.0.0.1 nas.local\n");
    }

    #[test]
    fn reads_and_writes_the_requests() {
        let block = Request::Block {
            hostnames: vec!["reddit.com".into()],
        };
        let line = serde_json::to_string(&block).unwrap();
        assert_eq!(line, r#"{"type":"block","hostnames":["reddit.com"]}"#);
        assert_eq!(serde_json::from_str::<Request>(&line).unwrap(), block);
        assert_eq!(
            serde_json::from_str::<Request>(r#"{"type":"hello"}"#).unwrap(),
            Request::Hello
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn quotes_what_it_hands_the_shell_and_applescript() {
        let script = mac::install_script("/Applications/Lock In's \"test\".app/Contents/MacOS/lock-in", 501);
        assert!(script.contains(r#"'/Applications/Lock In'\''s "test".app/Contents/MacOS/lock-in'"#));
        assert!(script.contains("<string>--uid</string><string>501</string>"));
        assert_eq!(mac::sh_quote("it's"), r"'it'\''s'");
        assert_eq!(mac::applescript_quote(r#"say "hi" \ bye"#), r#"say \"hi\" \\ bye"#);
        assert!(mac::remove_script().contains("--blocker-clean"));
    }
}
