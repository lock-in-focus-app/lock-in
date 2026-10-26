// The app's side of the link to the browser extension. Browsers can only talk to a program
// they start themselves (Native Messaging), so each browser starts a small bridge process
// (bridge.rs) that connects here over a local socket. Messages are JSON, one per line.

use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use interprocess::local_socket::tokio::{Stream, prelude::*};
use interprocess::local_socket::{ListenerOptions, Name};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;

use crate::session::{GateVisit, Profile, Session};
use crate::store::Synced;

/// Bumped when a change to the messages would break older extensions.
pub const PROTOCOL: u32 = 1;

/// Chrome refuses messages to an extension over 1 MB, so nothing bigger is sent either way.
pub const MAX_MESSAGE: usize = 1024 * 1024;

/// The app's id, which names its data folder. Matches `identifier` in tauri.conf.json.
pub const IDENTIFIER: &str = "io.github.lock-in-focus-app.lock-in";

/// Where the app keeps its data, readable by this user only. The bridge finds the socket here.
pub fn data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(IDENTIFIER))
}

/// The local socket the bridge connects to: a file in the data folder, or a named pipe on Windows.
pub fn socket_name() -> io::Result<Name<'static>> {
    #[cfg(unix)]
    {
        use interprocess::local_socket::GenericFilePath;
        let dir = data_dir().ok_or_else(|| io::Error::other("no data folder"))?;
        dir.join("link.sock")
            .to_fs_name::<GenericFilePath>()
            .map(|name| name.into_owned())
    }
    #[cfg(windows)]
    {
        use interprocess::local_socket::GenericNamespaced;
        format!("{IDENTIFIER}.link")
            .to_ns_name::<GenericNamespaced>()
            .map(|name| name.into_owned())
    }
}

/// Messages from the extension.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum FromExtension {
    Hello {
        protocol: u32,
        browser: String,
    },
    /// The extension's profiles and session. Each is taken if it's newer than the app's.
    State {
        profiles: Option<Synced<Vec<Profile>>>,
        active_session: Option<Synced<Option<Session>>>,
    },
    GateVisit {
        visit: GateVisit,
    },
    /// From a newer extension; ignored.
    #[serde(other)]
    Unknown,
}

/// Messages to the extension. The bridge also sends `linked` and `unlinked` as the app comes and goes.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ToExtension<'a> {
    State {
        profiles: &'a Synced<Vec<Profile>>,
        active_session: &'a Synced<Option<Session>>,
    },
}

/// The connected bridges, one per browser, each with a queue of lines to send it.
#[derive(Default)]
pub struct Links {
    next_id: AtomicU64,
    senders: Mutex<HashMap<u64, mpsc::UnboundedSender<Arc<str>>>>,
}

impl Links {
    fn senders(&self) -> std::sync::MutexGuard<'_, HashMap<u64, mpsc::UnboundedSender<Arc<str>>>> {
        self.senders.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Sends the current profiles and session to every connected browser.
pub fn broadcast(app: &AppHandle) {
    let Some(line) = state_line(app) else { return };
    for sender in app.state::<Links>().senders().values() {
        let _ = sender.send(line.clone());
    }
}

fn state_line(app: &AppHandle) -> Option<Arc<str>> {
    let engine = crate::engine(app);
    let (profiles, active_session) = engine.synced();
    let line = serde_json::to_string(&ToExtension::State {
        profiles,
        active_session,
    })
    .ok()?;
    if line.len() > MAX_MESSAGE {
        eprintln!(
            "Lock In: profiles are too big to send to the browser ({} bytes)",
            line.len()
        );
        return None;
    }
    Some(line.into())
}

/// Listens for bridges until the app quits.
pub async fn serve(app: AppHandle) {
    let listener = match socket_name().and_then(|name| {
        // A socket file left behind by a crash would otherwise block this one. The single
        // instance plugin makes sure it isn't another copy of Lock In that's still running.
        ListenerOptions::new().name(name).try_overwrite(true).create_tokio()
    }) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("Lock In: couldn't listen for the browser extension: {error}");
            return;
        }
    };
    loop {
        match listener.accept().await {
            Ok(stream) => {
                tauri::async_runtime::spawn(handle(app.clone(), stream));
            }
            Err(error) => eprintln!("Lock In: a browser couldn't connect: {error}"),
        }
    }
}

async fn handle(app: AppHandle, stream: Stream) {
    let links = app.state::<Links>();
    let id = links.next_id.fetch_add(1, Ordering::Relaxed);
    let (sender, mut queue) = mpsc::unbounded_channel::<Arc<str>>();
    if let Some(line) = state_line(&app) {
        let _ = sender.send(line);
    }
    links.senders().insert(id, sender);

    let (receive, mut send) = stream.split();
    let writer = async {
        while let Some(line) = queue.recv().await {
            send.write_all(line.as_bytes()).await?;
            send.write_all(b"\n").await?;
        }
        Ok::<_, io::Error>(())
    };
    let reader = async {
        let mut lines = BufReader::new(receive).lines();
        while let Some(line) = lines.next_line().await? {
            if line.len() <= MAX_MESSAGE {
                on_message(&app, &line);
            }
        }
        Ok::<_, io::Error>(())
    };
    // Whichever side stops first (usually the browser closing) ends the link.
    tokio::select! {
        _ = writer => {}
        _ = reader => {}
    }
    links.senders().remove(&id);
}

fn on_message(app: &AppHandle, line: &str) {
    let message = match serde_json::from_str::<FromExtension>(line) {
        Ok(message) => message,
        Err(error) => {
            eprintln!("Lock In: couldn't read a message from the browser: {error}");
            return;
        }
    };
    match message {
        FromExtension::Hello { protocol, browser } => {
            if protocol != PROTOCOL {
                eprintln!("Lock In: {browser} speaks link protocol {protocol}, the app speaks {PROTOCOL}");
            }
        }
        FromExtension::State {
            profiles,
            active_session,
        } => {
            let changed = crate::engine(app).apply_remote(profiles, active_session, crate::now_ms());
            match changed {
                Ok(true) => crate::changed(app),
                // Sends the app's newer state back, in case the browser's was out of date.
                Ok(false) => broadcast(app),
                Err(error) => eprintln!("Lock In: couldn't save the browser's changes: {error}"),
            }
        }
        FromExtension::GateVisit { visit } => {
            if let Err(error) = crate::engine(app).record_gate_visit(visit) {
                eprintln!("Lock In: couldn't log a gate visit: {error}");
            }
        }
        FromExtension::Unknown => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_what_the_extension_sends() {
        let state = r#"{"type":"state","profiles":{"value":[{"id":"p","name":"P","sites":[]}],"updatedAt":5},
            "activeSession":{"value":{"id":"s","profileId":"p","startedAt":1,"passes":{}},"updatedAt":6}}"#;
        let FromExtension::State {
            profiles,
            active_session,
        } = serde_json::from_str(state).unwrap()
        else {
            panic!("not a state message");
        };
        assert_eq!(profiles.unwrap().value[0].name, "P");
        assert_eq!(active_session.unwrap().value.unwrap().profile_id, "p");

        let ended = r#"{"type":"state","activeSession":{"value":null,"updatedAt":9}}"#;
        assert!(matches!(
            serde_json::from_str(ended).unwrap(),
            FromExtension::State {
                profiles: None,
                active_session: Some(Synced {
                    value: None,
                    updated_at: 9
                })
            }
        ));

        let hello = r#"{"type":"hello","protocol":1,"browser":"chrome"}"#;
        assert!(matches!(
            serde_json::from_str(hello).unwrap(),
            FromExtension::Hello { protocol: 1, .. }
        ));

        let visit = r#"{"type":"gateVisit","visit":{"id":"v","recipeId":"x","at":3,"why":"bored","continued":true}}"#;
        assert!(matches!(
            serde_json::from_str(visit).unwrap(),
            FromExtension::GateVisit { .. }
        ));

        let newer = r#"{"type":"somethingNew","x":1}"#;
        assert!(matches!(serde_json::from_str(newer).unwrap(), FromExtension::Unknown));
    }

    #[test]
    fn writes_state_as_the_extension_expects() {
        let profiles = Synced {
            value: vec![],
            updated_at: 1,
        };
        let session = Synced {
            value: None,
            updated_at: 2,
        };
        let line = serde_json::to_string(&ToExtension::State {
            profiles: &profiles,
            active_session: &session,
        })
        .unwrap();
        assert_eq!(
            line,
            r#"{"type":"state","profiles":{"value":[],"updatedAt":1},"activeSession":{"value":null,"updatedAt":2}}"#
        );
    }

    #[test]
    fn identifier_matches_the_tauri_config() {
        let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(config["identifier"], IDENTIFIER);
    }
}
