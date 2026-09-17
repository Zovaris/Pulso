mod app;
mod commands;
mod detectors;
mod domain;
mod events;
mod persistence;
mod platform;
mod process;
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

            let notifier = {
                let handle = handle.clone();
                Arc::new(move |execution: &domain::execution::Execution| {
                    events::execution_changed(&handle, execution);
                    app::tray::sync(&handle);
                    app::cues::observe(&handle, execution);
                })
            };
            let log_notifier = {
                let handle = handle.clone();
                Arc::new(move |execution_id: i64, lines: &[domain::log::LogLine]| {
                    events::log_appended(&handle, execution_id, lines)
                })
            };
            app.manage(Arc::new(process::supervisor::ProcessSupervisor::new(
                notifier,
                log_notifier,
            )));

            app::tray::install(&handle)?;

            if std::env::var("SOFFY_SHOW_MAIN").as_deref() == Ok("1") {
                app::windows::show_main(&handle);
            }

            if let Some(win) = app::windows::main_window(&handle) {
                let handle = handle.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        app::windows::hide_main(&handle);
                    }
                });
            }

            if let Some(win) = app::windows::popover(&handle) {
                let handle = handle.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        if !app::picker::is_open() {
                            app::windows::close_popover(&handle);
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
            commands::projects::rescan_projects,
            commands::tray::set_tray_badge,
            commands::executions::list_executions,
            commands::executions::start_command,
            commands::executions::stop_execution,
            commands::executions::get_log_snapshot,
            commands::executions::open_detected_url,
            commands::settings::get_preferences,
            commands::settings::save_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
