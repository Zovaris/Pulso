use tauri::AppHandle;

use crate::app::{attention, tray};
use crate::support::error::{BackendError, Result};

#[tauri::command]
pub fn set_tray_badge(app: AppHandle, png: Option<Vec<u8>>) -> Result<()> {
    tray::set_badge(&app, png.as_deref())
        .map_err(|error| BackendError::internal(format!("The tray icon did not change: {error}")))
}

#[tauri::command]
pub fn failures_seen_at() -> i64 {
    attention::seen_at()
}

/// The user looked at what failed: the menu bar dot and the sidebar clear in
/// every window at once.
#[tauri::command]
pub fn mark_failures_seen(app: AppHandle) -> i64 {
    attention::mark_seen(&app)
}
