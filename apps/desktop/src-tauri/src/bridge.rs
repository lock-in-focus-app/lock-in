// The bridge between a browser and the app. The browser starts Lock In's own executable
// when the extension connects (Native Messaging), and talks to it over stdin and stdout:
// each message is a 4-byte length, then that many bytes of JSON. This process passes the
// messages on to the running app over its local socket, one JSON message per line, and
// never starts the app's window or menu bar.

use std::io::{self, BufRead, BufReader, Read, Write};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use interprocess::local_socket::{Stream, prelude::*};

use crate::link::{MAX_MESSAGE, socket_name};

/// How often to look for the app while it isn't running. Each check is one quick connect attempt.
const RETRY: Duration = Duration::from_secs(2);

/// Whether the browser started this process to talk to the extension. Chrome passes the
/// extension's origin; Firefox passes the path to the host manifest and the extension's id.
pub fn launched_by_browser(args: &[String]) -> bool {
    let chrome = args.iter().skip(1).any(|arg| arg.starts_with("chrome-extension://"));
    let firefox = args.len() == 3 && args[1].ends_with(".json");
    chrome || firefox
}

enum Event {
    FromBrowser(Vec<u8>),
    BrowserGone,
    /// The link to the app with this number closed.
    AppGone(u64),
}

/// Runs the bridge until the browser closes it. Returns the exit code.
pub fn run() -> i32 {
    let (events, inbox) = mpsc::channel();

    let from_browser = events.clone();
    thread::spawn(move || {
        let mut stdin = io::stdin().lock();
        loop {
            match read_frame(&mut stdin) {
                Ok(Some(message)) => {
                    if from_browser.send(Event::FromBrowser(message)).is_err() {
                        break;
                    }
                }
                Ok(None) => {}
                Err(_) => {
                    let _ = from_browser.send(Event::BrowserGone);
                    break;
                }
            }
        }
    });

    let stdout = Arc::new(Mutex::new(io::stdout()));
    let Ok(name) = socket_name() else { return 1 };
    let mut link_number = 0;

    loop {
        // Waits for the app. Messages from the extension in the meantime are dropped; it
        // sends everything again once it hears `linked`.
        let stream = loop {
            if let Ok(stream) = Stream::connect(name.borrow()) {
                break stream;
            }
            match inbox.recv_timeout(RETRY) {
                Ok(Event::BrowserGone) | Err(RecvTimeoutError::Disconnected) => return 0,
                Ok(_) | Err(RecvTimeoutError::Timeout) => {}
            }
        };
        link_number += 1;

        let (receive, mut send) = stream.split();
        let to_browser = Arc::clone(&stdout);
        let app_gone = events.clone();
        let number = link_number;
        thread::spawn(move || {
            for line in BufReader::new(receive).split(b'\n') {
                let Ok(line) = line else { break };
                if line.len() <= MAX_MESSAGE && write_frame(&to_browser, &line).is_err() {
                    break;
                }
            }
            let _ = app_gone.send(Event::AppGone(number));
        });
        if write_frame(&stdout, br#"{"type":"linked"}"#).is_err() {
            return 0;
        }

        loop {
            match inbox.recv() {
                Ok(Event::FromBrowser(message)) => {
                    if send.write_all(&message).and_then(|()| send.write_all(b"\n")).is_err() {
                        break;
                    }
                }
                Ok(Event::AppGone(number)) if number == link_number => break,
                Ok(Event::AppGone(_)) => {}
                Ok(Event::BrowserGone) | Err(_) => return 0,
            }
        }
        if write_frame(&stdout, br#"{"type":"unlinked"}"#).is_err() {
            return 0;
        }
    }
}

/// Reads one message from the browser. Returns `None` for a message that's skipped: too big,
/// or with a raw line break that would split it in two (JSON from the browser never has one).
fn read_frame(input: &mut impl Read) -> io::Result<Option<Vec<u8>>> {
    let mut length = [0; 4];
    input.read_exact(&mut length)?;
    let length = u32::from_ne_bytes(length) as usize;
    if length > MAX_MESSAGE {
        io::copy(&mut input.take(length as u64), &mut io::sink())?;
        return Ok(None);
    }
    let mut message = vec![0; length];
    input.read_exact(&mut message)?;
    Ok((!message.contains(&b'\n')).then_some(message))
}

fn write_frame(output: &Mutex<impl Write>, message: &[u8]) -> io::Result<()> {
    let mut output = output.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    output.write_all(&(message.len() as u32).to_ne_bytes())?;
    output.write_all(message)?;
    output.flush()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(message: &[u8]) -> Vec<u8> {
        let mut bytes = (message.len() as u32).to_ne_bytes().to_vec();
        bytes.extend_from_slice(message);
        bytes
    }

    #[test]
    fn spots_a_launch_by_the_browser() {
        let args = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(launched_by_browser(&args(&["lock-in", "chrome-extension://abc/"])));
        assert!(launched_by_browser(&args(&[
            "lock-in",
            "chrome-extension://abc/",
            "--parent-window=0"
        ])));
        assert!(launched_by_browser(&args(&[
            "lock-in",
            "/Users/me/Library/Application Support/Mozilla/NativeMessagingHosts/x.json",
            "lock-in@example"
        ])));
        assert!(!launched_by_browser(&args(&["lock-in"])));
        assert!(!launched_by_browser(&args(&["lock-in", "--hidden"])));
    }

    #[test]
    fn reads_framed_messages() {
        let mut input = io::Cursor::new([frame(b"{\"a\":1}"), frame(b"{}")].concat());
        assert_eq!(read_frame(&mut input).unwrap(), Some(b"{\"a\":1}".to_vec()));
        assert_eq!(read_frame(&mut input).unwrap(), Some(b"{}".to_vec()));
        assert!(read_frame(&mut input).is_err());
    }

    #[test]
    fn skips_messages_it_cannot_pass_on() {
        let big = vec![b' '; MAX_MESSAGE + 1];
        let mut input = io::Cursor::new([frame(&big), frame(b"{\n}"), frame(b"{}")].concat());
        assert_eq!(read_frame(&mut input).unwrap(), None);
        assert_eq!(read_frame(&mut input).unwrap(), None);
        assert_eq!(read_frame(&mut input).unwrap(), Some(b"{}".to_vec()));
    }

    #[test]
    fn writes_framed_messages() {
        let output = Mutex::new(Vec::new());
        write_frame(&output, b"{}").unwrap();
        assert_eq!(output.into_inner().unwrap(), frame(b"{}"));
    }
}
