use tauri::AppHandle;

use crate::app::windows;

#[tauri::command]
pub fn quit_soffy(app: AppHandle) {
    windows::hide_popover(&app);
    if let Some(win) = windows::main_window(&app) {
        let _ = win.hide();
    }
    app.exit(0);
}

#[tauri::command]
pub fn open_main_window(app: AppHandle) {
    windows::show_main(&app);
}

#[tauri::command]
pub fn hide_popover(app: AppHandle) {
    windows::hide_popover(&app);
}

#[tauri::command]
pub async fn pick_project_folder(app: AppHandle, title: String) -> Option<String> {
    crate::app::picker::pick_folder(&app, title).await
}

#[tauri::command]
pub fn save_appearance(_theme: String, _transparency: bool) {}
