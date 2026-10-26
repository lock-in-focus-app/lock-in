use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuEvent};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Wry};

use crate::engine::Snapshot;

const TRAY_ID: &str = "main";
const START_PREFIX: &str = "start:";

/// Adds the menu-bar icon. Its menu is rebuilt whenever the session or profiles change.
pub fn create(app: &AppHandle, snapshot: &Snapshot) -> tauri::Result<()> {
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        // On macOS a template icon is drawn in the menu bar's own colors, light or dark.
        .icon_as_template(true)
        .tooltip("Lock In")
        .menu(&menu(app, snapshot)?)
        .on_menu_event(on_menu_event)
        .build(app)?;
    Ok(())
}

pub fn refresh(app: &AppHandle, snapshot: &Snapshot) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu(app, snapshot)?))?;
    }
    Ok(())
}

fn menu(app: &AppHandle, snapshot: &Snapshot) -> tauri::Result<Menu<Wry>> {
    let mut builder = MenuBuilder::new(app);
    builder = match &snapshot.session {
        Some(session) => builder
            .item(&disabled(app, &format!("Locked in · {}", session.profile_name))?)
            .text("end", "End session"),
        None => {
            builder = builder.item(&disabled(app, "Start a session")?);
            for profile in &snapshot.profiles {
                builder = builder.text(format!("{START_PREFIX}{}", profile.id), &profile.name);
            }
            builder
        }
    };
    builder
        .separator()
        .text("open", "Open Lock In…")
        .text("quit", "Quit Lock In")
        .build()
}

fn disabled(app: &AppHandle, text: &str) -> tauri::Result<tauri::menu::MenuItem<Wry>> {
    tauri::menu::MenuItem::new(app, text, false, None::<&str>)
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    let result = match id {
        "end" => crate::end_session(app),
        "open" => crate::open_window(app),
        "quit" => {
            app.exit(0);
            Ok(())
        }
        _ => match id.strip_prefix(START_PREFIX) {
            Some(profile_id) => crate::start_session(app, profile_id),
            None => Ok(()),
        },
    };
    if let Err(error) = result {
        eprintln!("Lock In: {error}");
    }
}
