//! Backups: everything the app keeps, in one JSON file that can be brought into Lock In on this
//! computer or another one (PLAN §2). Importing adds to what's here and never takes anything
//! away, so bringing in the same file twice changes nothing the second time.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::engine::{ConstellationName, SkyState};
use crate::error::{Error, Result};
use crate::quotes::OwnQuote;
use crate::satellites::SatelliteState;
use crate::session::{GateVisit, Profile, SessionRecord};
use crate::settings::Settings;

/// What the first field of every backup says, so other JSON files are turned away.
const KIND: &str = "backup";

/// The backup format this app writes. A file with a higher version comes from a newer Lock In
/// and might hold things this one would lose, so it isn't imported.
pub const VERSION: u32 = 1;

/// The biggest backup file that's read. Years of sessions come to a few megabytes.
pub const MAX_BYTES: usize = 64 * 1024 * 1024;

/// The whole file. Fields a later version adds are ignored by this one.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub lock_in: String,
    pub version: u32,
    /// Epoch milliseconds.
    pub exported_at: i64,
    /// Profiles as they're saved, with everything the extension keeps in them.
    #[serde(default)]
    pub profiles: Vec<Profile>,
    #[serde(default)]
    pub settings: Option<Settings>,
    #[serde(default)]
    pub own_quotes: Vec<OwnQuote>,
    /// The night sky's secret, so the same log draws the same sky on another computer.
    #[serde(default)]
    pub sky: Option<SkyState>,
    #[serde(default)]
    pub history: History,
}

/// Everything logged, which the night sky and the weekly report are worked out from.
#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct History {
    pub sessions: Vec<SessionRecord>,
    pub gate_visits: Vec<LoggedVisit>,
    pub satellites: Vec<LoggedSatellite>,
    pub constellation_names: Vec<ConstellationName>,
}

/// A trip to a redirected site, with the session it happened in.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggedVisit {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(flatten)]
    pub visit: GateVisit,
}

/// A satellite with all that's kept about it, including what it said.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoggedSatellite {
    pub id: String,
    pub text: String,
    /// Epoch milliseconds.
    pub launched_at: i64,
    #[serde(default)]
    pub session_id: Option<String>,
    pub state: SatelliteState,
    pub state_at: i64,
    #[serde(default)]
    pub snoozes: u32,
    #[serde(default)]
    pub tasked_at: Option<i64>,
}

/// What an import added, for the line Settings shows after it.
#[derive(Clone, Debug, Default, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportReport {
    /// Profiles that weren't here yet.
    pub new_profiles: u32,
    /// Profiles that were here, now as the file has them.
    pub updated_profiles: u32,
    pub sessions: u32,
    pub gate_visits: u32,
    pub satellites: u32,
    pub quotes: u32,
}

/// Where an export was saved.
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SavedBackup {
    pub file_name: String,
    /// The folder's own name, like "Downloads".
    pub folder: String,
}

/// The last backup saved, so Settings can show it in Finder.
#[derive(Default)]
pub struct LastBackup(pub Mutex<Option<PathBuf>>);

impl Backup {
    pub fn new(exported_at: i64) -> Self {
        Self {
            lock_in: KIND.into(),
            version: VERSION,
            exported_at,
            profiles: vec![],
            settings: None,
            own_quotes: vec![],
            sky: None,
            history: History::default(),
        }
    }

    /// Reads a backup file, turning away anything that isn't one or that a newer Lock In made.
    pub fn read(json: &str) -> Result<Self> {
        if json.len() > MAX_BYTES {
            return Err(Error::Backup("that file is too big to be a Lock In backup".into()));
        }
        let value: Value = serde_json::from_str(json).map_err(|_| not_a_backup())?;
        if value.get("lockIn").and_then(Value::as_str) != Some(KIND) {
            return Err(not_a_backup());
        }
        match value.get("version").and_then(Value::as_u64) {
            Some(version) if version <= u64::from(VERSION) => {}
            Some(_) => {
                return Err(Error::Backup(
                    "that backup comes from a newer version of Lock In; update this one to bring it in".into(),
                ));
            }
            None => return Err(not_a_backup()),
        }
        serde_json::from_value(value).map_err(|error| Error::Backup(format!("that backup can't be read: {error}")))
    }
}

fn not_a_backup() -> Error {
    Error::Backup("that file isn't a Lock In backup".into())
}

/// Saves a backup in the Downloads folder (or the home folder, if there's none) as "Lock In
/// backup 2026-10-29.json", numbering it if that's taken. Only the user can read it, since it
/// holds what their satellites say. `day` is the local date, from the window.
pub fn save(backup: &Backup, day: &str) -> Result<PathBuf> {
    let folder = dirs::download_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| Error::Backup("there's no Downloads folder to save it in".into()))?;
    save_in(&folder, backup, day)
}

fn save_in(folder: &Path, backup: &Backup, day: &str) -> Result<PathBuf> {
    // The date goes into a file name, so it's only used if it's nothing but a date.
    let dated = day.len() == 10 && day.bytes().all(|b| b.is_ascii_digit() || b == b'-');
    let base = if dated {
        format!("Lock In backup {day}")
    } else {
        "Lock In backup".into()
    };
    let json = serde_json::to_vec_pretty(backup)?;
    for number in 1..1000 {
        let name = match number {
            1 => format!("{base}.json"),
            n => format!("{base} {n}.json"),
        };
        let path = folder.join(name);
        let mut options = OpenOptions::new();
        // Never over an existing file, even one that appears between looking and writing.
        options.write(true).create_new(true);
        #[cfg(unix)]
        std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
        match options.open(&path) {
            Ok(mut file) => {
                file.write_all(&json)?;
                return Ok(path);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(Error::Backup(
        "there are too many backups with that name already".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turns_away_files_that_arent_backups() {
        let message = |json: &str| Backup::read(json).unwrap_err().to_string();
        assert_eq!(message("not json"), "that file isn't a Lock In backup");
        assert_eq!(message(r#"{"profiles":[]}"#), "that file isn't a Lock In backup");
        assert_eq!(
            message(r#"{"lockIn":"backup","version":"one"}"#),
            "that file isn't a Lock In backup"
        );
        assert!(message(r#"{"lockIn":"backup","version":2,"exportedAt":0}"#).contains("newer version"));
        assert!(message(r#"{"lockIn":"backup","version":1,"exportedAt":0,"profiles":[{}]}"#).contains("can't be read"));
    }

    #[test]
    fn reads_what_it_writes_and_ignores_what_it_doesnt_know() {
        let mut backup = Backup::new(42);
        backup.own_quotes.push(OwnQuote::new("Ship it.", "").unwrap());
        let mut json: Value = serde_json::to_value(&backup).unwrap();
        json["fromTheFuture"] = Value::Bool(true);
        let read = Backup::read(&json.to_string()).unwrap();
        assert_eq!((read.exported_at, read.own_quotes), (42, backup.own_quotes));
    }

    #[test]
    fn saves_next_to_earlier_backups_without_replacing_them() {
        let folder = std::env::temp_dir().join(format!("lock-in-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&folder).unwrap();
        let backup = Backup::new(1);
        let first = save_in(&folder, &backup, "2026-10-29").unwrap();
        let second = save_in(&folder, &backup, "2026-10-29").unwrap();
        let undated = save_in(&folder, &backup, "../../etc").unwrap();
        let name = |path: &Path| path.file_name().unwrap().to_string_lossy().into_owned();
        assert_eq!(name(&first), "Lock In backup 2026-10-29.json");
        assert_eq!(name(&second), "Lock In backup 2026-10-29 2.json");
        assert_eq!(undated, folder.join("Lock In backup.json"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&first).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600, "only the user can read it");
        }
        std::fs::remove_dir_all(folder).unwrap();
    }
}
