// Commands the window can call with `invoke('name', { args })`. Tauri turns the camelCase
// argument names the UI uses into these snake_case ones.

use tauri::AppHandle;

use crate::apps::{AppRule, InstalledApp};
use crate::engine::{Activity, Snapshot};
use crate::error::Result;
use crate::satellites::SatelliteAction;
use crate::session::{EndReason, SessionRecord};
use crate::settings::Settings;
use crate::timer::TimerSettings;

#[tauri::command]
pub fn snapshot(app: AppHandle) -> Snapshot {
    crate::engine(&app).snapshot(crate::now_ms())
}

#[tauri::command]
pub fn start_session(app: AppHandle, profile_id: String) -> Result<()> {
    crate::start_session(&app, &profile_id)
}

/// Ends the session. The window asks for a Gentle or Medium session's pause or typing first.
#[tauri::command]
pub fn end_session(app: AppHandle) -> Result<()> {
    crate::end_session(&app, EndReason::Stopped)
}

/// Ends a Hard session before its timer is done, using up an emergency pass.
#[tauri::command]
pub fn use_emergency_pass(app: AppHandle) -> Result<()> {
    crate::end_session(&app, EndReason::EmergencyPass)
}

#[tauri::command]
pub fn set_profile_timer(app: AppHandle, profile_id: String, timer: TimerSettings) -> Result<()> {
    crate::engine(&app).set_profile_timer(&profile_id, timer, crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_profile_star_color(app: AppHandle, profile_id: String, color: String) -> Result<()> {
    crate::engine(&app).set_profile_star_color(&profile_id, &color, crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: Settings) -> Result<()> {
    crate::engine(&app).set_settings(settings, crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

/// Stops watching a browser during sessions. Only between sessions.
#[tauri::command]
pub fn forget_browser(app: AppHandle, path: String) -> Result<()> {
    crate::engine(&app).forget_browser(&path, crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_profile_apps(app: AppHandle, profile_id: String, apps: Vec<AppRule>) -> Result<()> {
    crate::engine(&app).set_profile_apps(&profile_id, apps, crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

/// The apps that can be added to a profile, leaving out Lock In itself. Reading them touches
/// the disk, so it runs off the main thread.
#[tauri::command]
pub async fn installed_apps() -> Vec<InstalledApp> {
    let own = std::env::current_exe().ok();
    tauri::async_runtime::spawn_blocking(move || {
        let mut apps = crate::apps::installed();
        apps.retain(|app| own.as_deref() != Some(std::path::Path::new(&app.path)));
        apps
    })
    .await
    .unwrap_or_default()
}

/// Launches a thought into orbit. Returns whether there was anything to launch.
#[tauri::command]
pub fn launch_satellite(app: AppHandle, text: String) -> Result<bool> {
    let launched = crate::engine(&app).launch_satellite(&text, crate::now_ms())?;
    if launched {
        crate::satellites_changed(&app);
    }
    Ok(launched)
}

/// Ticks off, snoozes, keeps as a task or deletes a satellite.
#[tauri::command]
pub fn act_on_satellite(app: AppHandle, id: String, action: SatelliteAction) -> Result<()> {
    crate::engine(&app).act_on_satellite(&id, action, crate::now_ms())?;
    crate::satellites_changed(&app);
    Ok(())
}

/// Every finished session, oldest first, for the night sky.
#[tauri::command]
pub fn session_log(app: AppHandle) -> Result<Vec<SessionRecord>> {
    crate::engine(&app).session_log()
}

/// Everything logged from `from` up to (not including) `to` (epoch ms), for the weekly report.
#[tauri::command]
pub fn activity(app: AppHandle, from: i64, to: i64) -> Result<Activity> {
    crate::engine(&app).activity(from, to)
}

/// The first day of the week as set on this computer, 0 being Sunday, or null if the system
/// doesn't say.
#[tauri::command]
pub fn first_weekday() -> Option<u8> {
    crate::calendar::first_weekday()
}

/// Closes the satellite box and hands focus back to the app you were in.
#[tauri::command]
pub fn close_capture(app: AppHandle) -> Result<()> {
    crate::capture::close(&app, true)
}
