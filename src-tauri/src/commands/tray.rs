use tauri::AppHandle;

use crate::app::tray;
use crate::support::error::{BackendError, Result};

#[tauri::command]
pub fn set_tray_badge(app: AppHandle, png: Option<Vec<u8>>) -> Result<()> {
    tray::set_badge(&app, png.as_deref())
        .map_err(|error| BackendError::internal(format!("The tray icon did not change: {error}")))
}
