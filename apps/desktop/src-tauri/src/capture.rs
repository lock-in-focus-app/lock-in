// The satellite box: a small, Spotlight-style window for launching a thought from anywhere,
// opened with Alt+P (Option+P on a Mac) or from the menu bar.

use std::sync::Mutex;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::error::Result;
use crate::processes;

pub const WINDOW: &str = "capture";

fn hotkey() -> Shortcut {
    Shortcut::new(Some(Modifiers::ALT), Code::KeyP)
}

/// Hears the hotkey from anywhere. `listen` turns it on once the app is set up.
pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if *shortcut == hotkey()
                && event.state() == ShortcutState::Pressed
                && let Err(error) = open(app)
            {
                eprintln!("Lock In: couldn't open the satellite box: {error}");
            }
        })
        .build()
}

/// Starts listening for the hotkey. Another app may already have it, so that only gets logged;
/// the box still opens from the menu bar.
pub fn listen(app: &AppHandle) {
    if let Err(error) = app.global_shortcut().register(hotkey()) {
        eprintln!("Lock In: couldn't set up Alt+P for satellites: {error}");
    }
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
    // see-through, with room around the box for its shadow, so the box can fade in and out
    // over whatever's open (Capture.vue) rather than appear as a solid rectangle. On macOS that
    // needs `macOSPrivateApi` in tauri.conf.json, which only rules out the Mac App Store.
    let window = WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::App("capture.html".into()))
        .title("Launch a satellite")
        .inner_size(688.0, 118.0)
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
