// Commands the window can call with `invoke('name', { args })`. Tauri turns the camelCase
// argument names the UI uses into these snake_case ones.

use tauri::AppHandle;

use crate::engine::Snapshot;
use crate::error::Result;
use crate::timer::TimerSettings;

#[tauri::command]
pub fn snapshot(app: AppHandle) -> Snapshot {
    crate::engine(&app).snapshot()
}

#[tauri::command]
pub fn start_session(app: AppHandle, profile_id: String) -> Result<()> {
    crate::start_session(&app, &profile_id)
}

#[tauri::command]
pub fn end_session(app: AppHandle) -> Result<()> {
    crate::end_session(&app)
}

#[tauri::command]
pub fn set_profile_timer(app: AppHandle, profile_id: String, timer: TimerSettings) -> Result<()> {
    crate::engine(&app).set_profile_timer(&profile_id, timer, crate::now_ms())?;
    crate::changed(&app);
    Ok(())
}
