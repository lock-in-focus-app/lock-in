// The satellite box: a small, Spotlight-style window for launching a thought from anywhere,
// opened with its hotkey (Alt+P, or Option+P on a Mac, unless it's changed in Settings) or from
// the menu bar.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::error::Result;
use crate::hotkey::{self, Problem};
use crate::processes;

pub const WINDOW: &str = "capture";

/// Whether the hotkey is ignored for now, while Settings records a new one.
#[derive(Default)]
pub struct Paused(pub AtomicBool);

/// Hears the hotkey from anywhere. `listen` turns it on once the app is set up. It's the only
/// global shortcut the app registers, so any press is the hotkey.
pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            let paused = app.state::<Paused>().0.load(Ordering::Relaxed);
            if !paused
                && event.state() == ShortcutState::Pressed
                && let Err(error) = open(app)
            {
                eprintln!("Lock In: couldn't open the satellite box: {error}");
            }
        })
        .build()
}

/// Starts listening for the hotkey set in Settings, unless it's turned off. Another app may
/// already have it, so that only gets logged; the box still opens from the menu bar.
pub fn listen(app: &AppHandle) {
    let saved = crate::engine(app).settings().satellite_hotkey.clone();
    if saved.is_empty() {
        return;
    }
    let registered =
        hotkey::parse(&saved).and_then(|shortcut| app.global_shortcut().register(shortcut).map_err(|_| Problem::Taken));
    if let Err(problem) = registered {
        eprintln!("Lock In: couldn't set up {saved} for satellites: {problem}");
    }
}

/// Swaps the hotkey `old` for `new` (empty turns it off), and returns the new one as it's
/// saved. If the new one can't be used, the old one stays.
pub fn rebind(app: &AppHandle, old: &str, new: &str) -> Result<String> {
    let new = match new {
        "" => None,
        new => Some(hotkey::parse(new)?),
    };
    let old = hotkey::parse(old).ok();
    let shortcuts = app.global_shortcut();
    if new != old {
        // Not registered already if another app had it, which is fine.
        if let Some(old) = old {
            let _ = shortcuts.unregister(old);
        }
        if let Some(new) = new
            && shortcuts.register(new).is_err()
        {
            if let Some(old) = old {
                let _ = shortcuts.register(old);
            }
            return Err(Problem::Taken.into());
        }
    }
    Ok(new.map(|shortcut| hotkey::text(&shortcut)).unwrap_or_default())
}

/// The app that was in front when the box opened, to hand back to once it closes.
#[derive(Default)]
pub struct CameFrom(Mutex<Option<u32>>);

/// Opens the box in front of everything, or brings it back if it's already open.
pub fn open(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window(WINDOW) {
        window.set_focus()?;
        return Ok(());
    }
    *came_from(app) = processes::frontmost_other_app();
    // No Dock icon or app switcher entry: it's gone again in a few seconds. The window is
    // see-through, with room around the box for its shadow and the satellites circling it, so
    // the box can fade in and out over whatever's open (Capture.vue) rather than appear as a
    // solid rectangle. On macOS that needs `macOSPrivateApi` in tauri.conf.json, which only rules
    // out the Mac App Store.
    let window = WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::App("capture.html".into()))
        .title("Launch a satellite")
        .inner_size(760.0, 160.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .center()
        .build()?;
    window.set_focus()?;
    Ok(())
}

/// Closes the box. With `hand_back`, the app that was in front before gets focus again, as
/// after Spotlight. Without it (you clicked somewhere else), focus stays where it went.
pub fn close(app: &AppHandle, hand_back: bool) -> Result<()> {
    let came_from = came_from(app).take();
    if let Some(window) = app.get_webview_window(WINDOW) {
        window.close()?;
    }
    if hand_back && let Some(pid) = came_from {
        processes::activate(pid);
    }
    Ok(())
}

fn came_from(app: &AppHandle) -> std::sync::MutexGuard<'_, Option<u32>> {
    app.state::<CameFrom>()
        .inner()
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}
