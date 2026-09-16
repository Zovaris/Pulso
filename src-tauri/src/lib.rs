mod app;
mod commands;
mod detectors;
mod domain;
mod events;
mod persistence;
mod support;

use std::sync::Arc;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            let data_dir = handle.path().app_data_dir()?;
            app.manage(Arc::new(persistence::Database::open(
                &data_dir.join("soffy.db"),
            )?));

            app::tray::install(&handle)?;

            if std::env::var("SOFFY_SHOW_MAIN").as_deref() == Ok("1") {
                app::windows::show_main(&handle);
            }

            if let Some(win) = app::windows::popover(&handle) {
                let handle = handle.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        if !app::picker::is_open() {
                            app::windows::hide_popover(&handle);
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window::quit_soffy,
            commands::window::open_main_window,
            commands::window::hide_popover,
            commands::window::pick_project_folder,
            commands::projects::list_projects,
            commands::projects::add_project,
            commands::projects::remove_project,
            commands::projects::list_commands,
            commands::settings::get_appearance,
            commands::settings::save_appearance,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
