mod app;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app::tray::install(app.handle())?;
            if std::env::var("SOFFY_SHOW_MAIN").as_deref() == Ok("1") {
                app::windows::show_main(app.handle());
            }
            if let Some(win) = app::windows::popover(app.handle()) {
                let handle = app.handle().clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        app::windows::hide_popover(&handle);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::quit_soffy,
            commands::open_main_window,
            commands::hide_popover,
            commands::save_appearance,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
