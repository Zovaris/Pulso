use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::app::{picker, windows};
use crate::process::supervisor::ProcessSupervisor;
use crate::support::error::{BackendError, Result};

#[tauri::command]
pub async fn quit_soffy(
    app: AppHandle,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
) -> Result<()> {
    supervisor.stop_all().await;

    windows::hide_popover(&app);
    if let Some(win) = windows::main_window(&app) {
        let _ = win.hide();
    }
    app.exit(0);

    Ok(())
}

#[tauri::command]
pub fn open_main_window(app: AppHandle) -> Result<()> {
    if windows::show_main(&app) {
        return Ok(());
    }

    Err(BackendError::internal(
        "The main window is not there any more; restart Soffy.",
    ))
}

#[tauri::command]
pub fn hide_popover(app: AppHandle) {
    windows::hide_popover(&app);
}

#[tauri::command]
pub async fn pick_project_folder(app: AppHandle, title: String) -> Option<String> {
    picker::pick_folder(&app, title).await
}
