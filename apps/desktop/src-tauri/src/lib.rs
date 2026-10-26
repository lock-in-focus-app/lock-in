mod commands;
mod engine;
mod error;
mod session;
mod store;
mod timer;
mod tray;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_notification::NotificationExt;

use engine::Engine;
use error::Result;
use session::{EndReason, Session};
use store::Store;
use timer::TimerEnd;

const MAIN_WINDOW: &str = "main";

/// The current time in epoch milliseconds, like `Date.now()`.
pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}

pub(crate) fn engine(app: &AppHandle) -> MutexGuard<'_, Engine> {
    // A panic while the lock was held "poisons" it. The engine saves every change before
    // updating itself, so it's still safe to use.
    app.state::<Mutex<Engine>>()
        .inner()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub(crate) fn start_session(app: &AppHandle, profile_id: &str) -> Result<()> {
    engine(app).start_session(profile_id, now_ms())?;
    changed(app);
    Ok(())
}

pub(crate) fn end_session(app: &AppHandle) -> Result<()> {
    engine(app).end_session(now_ms(), EndReason::Stopped)?;
    changed(app);
    Ok(())
}

/// Tells the window and the menu bar about a change, and schedules the session's timer.
pub(crate) fn changed(app: &AppHandle) {
    // Copy what's needed and let go of the engine first, so the menu bar (which runs on the
    // main thread) never waits on a lock another thread holds.
    let (snapshot, session) = {
        let engine = engine(app);
        (engine.snapshot(), engine.session().cloned())
    };
    let _ = app.emit("snapshot", &snapshot);
    if let Err(error) = tray::refresh(app, &snapshot) {
        eprintln!("Lock In: couldn't update the menu bar: {error}");
    }
    schedule_timer(app, session, snapshot.session.map(|s| s.profile_name));
}

/// The running session's timer, waiting to go off.
#[derive(Default)]
struct TimerTask(Mutex<Option<JoinHandle<()>>>);

fn schedule_timer(app: &AppHandle, session: Option<Session>, profile_name: Option<String>) {
    let task = app.state::<TimerTask>();
    let mut task = task.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(previous) = task.take() {
        previous.abort();
    }

    let Some(session) = session else { return };
    let Some(timer) = session.timer else { return };
    let Some(done_at) = timer.done_at(session.started_at) else {
        return;
    };
    if done_at <= now_ms() || timer.on_end == TimerEnd::Silent {
        return;
    }

    let app = app.clone();
    let profile_name = profile_name.unwrap_or_default();
    *task = Some(tauri::async_runtime::spawn(async move {
        // Sleeps in steps of at most a minute, checking the clock each time. If the computer
        // sleeps, one long sleep would go off late by however long it was asleep.
        loop {
            let left = done_at - now_ms();
            if left <= 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(left.min(60_000) as u64)).await;
        }

        let mut notification = app.notification().builder().title("Timer done").body(format!(
            "{} minutes of {profile_name}. Keep going if you're in the flow.",
            timer.minutes
        ));
        if timer.on_end == TimerEnd::Alert {
            notification = notification.sound(ALERT_SOUND);
        }
        if let Err(error) = notification.show() {
            eprintln!("Lock In: couldn't show the timer notification: {error}");
        }
    }));
}

#[cfg(target_os = "macos")]
const ALERT_SOUND: &str = "Glass";
#[cfg(not(target_os = "macos"))]
const ALERT_SOUND: &str = "default";

/// Opens the window, or brings it to the front if it's already open.
pub(crate) fn open_window(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }
    // While the window is open, Lock In shows in the Dock and app switcher like any other app.
    #[cfg(target_os = "macos")]
    app.set_activation_policy(tauri::ActivationPolicy::Regular)?;
    WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::default())
        .title("Lock In")
        .inner_size(400.0, 600.0)
        .min_inner_size(340.0, 440.0)
        .build()?;
    Ok(())
}

/// Creates the app's data folder, readable by this user only.
fn create_private_dir(dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Opening Lock In again brings up the running app's window instead of starting a second copy.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Err(error) = open_window(app) {
                eprintln!("Lock In: couldn't open the window: {error}");
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Lock In lives in the menu bar, with no Dock icon until its window opens.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let dir = app.path().app_data_dir()?;
            create_private_dir(&dir)?;
            let engine = Engine::load(Store::open(&dir.join("lock-in.db"))?)?;
            let snapshot = engine.snapshot();
            let session = engine.session().cloned();
            app.manage(Mutex::new(engine));
            app.manage(TimerTask::default());

            tray::create(app.handle(), &snapshot)?;
            schedule_timer(app.handle(), session, snapshot.session.map(|s| s.profile_name));
            open_window(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window destroys it, webview and all, so only the small core keeps running.
            if let WindowEvent::Destroyed = event {
                #[cfg(target_os = "macos")]
                let _ = window
                    .app_handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory);
                #[cfg(not(target_os = "macos"))]
                let _ = window;
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::start_session,
            commands::end_session,
            commands::set_profile_timer,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Lock In")
        .run(|_app, event| {
            // With the window closed there are no windows left, which would normally quit the
            // app. Lock In keeps running in the menu bar until you choose Quit.
            if let RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        });
}
