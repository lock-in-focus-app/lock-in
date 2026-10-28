// Commands the window can call with `invoke('name', { args })`. Tauri turns the camelCase
// argument names the UI uses into these snake_case ones.

use tauri::{AppHandle, Manager};

use crate::apps::{AppRule, InstalledApp};
use crate::engine::{Activity, ConstellationName, SkyState, Snapshot};
use crate::error::{Error, Result};
use crate::satellites::SatelliteAction;
use crate::session::{EndReason, GateVisit, SessionRecord};
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

/// Changes the satellite box's hotkey, once the new one is registered. Empty turns it off.
#[tauri::command]
pub fn set_satellite_hotkey(app: AppHandle, hotkey: String) -> Result<()> {
    let old = crate::engine(&app).settings().satellite_hotkey.clone();
    let new = crate::capture::rebind(&app, &old, &hotkey)?;
    let saved = crate::engine(&app).set_satellite_hotkey(new.clone(), crate::now_ms());
    if let Err(error) = saved {
        let _ = crate::capture::rebind(&app, &new, &old);
        return Err(error);
    }
    crate::changed(&app);
    Ok(())
}

/// Ignores the satellite box's hotkey while Settings records a new one, so pressing the one
/// in use doesn't open the box.
#[tauri::command]
pub fn pause_satellite_hotkey(app: AppHandle, paused: bool) {
    app.state::<crate::capture::Paused>()
        .0
        .store(paused, std::sync::atomic::Ordering::Relaxed);
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

/// The names people gave constellations.
#[tauri::command]
pub fn constellation_names(app: AppHandle) -> Result<Vec<ConstellationName>> {
    crate::engine(&app).constellation_names()
}

/// Names a constellation, by the id of its first star. A blank name goes back to the made-up one.
#[tauri::command]
pub fn name_constellation(app: AppHandle, id: String, name: String) -> Result<()> {
    crate::engine(&app).name_constellation(&id, &name)
}

/// The night sky's secret for rare events, and when the Sky last showed new things.
#[tauri::command]
pub fn sky_state(app: AppHandle) -> Result<SkyState> {
    crate::engine(&app).sky_state(crate::now_ms())
}

/// Notes that the Sky has shown everything up to `at` (epoch ms), so it plays once.
#[tauri::command]
pub fn sky_seen(app: AppHandle, at: i64) -> Result<()> {
    crate::engine(&app).sky_seen(at, crate::now_ms())
}

/// Notes that the tour for new users has been offered, taken or turned down.
#[tauri::command]
pub fn tour_offered(app: AppHandle) -> Result<()> {
    crate::engine(&app).tour_offered(crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

/// Trips to redirected sites that went back to focus, oldest first, for comets.
#[tauri::command]
pub fn turned_back(app: AppHandle) -> Result<Vec<GateVisit>> {
    crate::engine(&app).turned_back()
}

/// Adds six weeks of made-up sessions, so the sky and the weekly report can be tried without
/// focusing for weeks. Development builds only.
#[tauri::command]
pub fn add_sample_data(app: AppHandle) -> Result<()> {
    if !cfg!(debug_assertions) {
        return Err(Error::DevelopmentOnly);
    }
    crate::engine(&app).add_samples(crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}

/// Removes the sample data again. Development builds only.
#[tauri::command]
pub fn remove_sample_data(app: AppHandle) -> Result<()> {
    if !cfg!(debug_assertions) {
        return Err(Error::DevelopmentOnly);
    }
    crate::engine(&app).remove_samples()?;
    crate::changed(&app);
    Ok(())
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
