use objc2_app_kit::NSWindow;
use tauri::WebviewWindow;

pub fn set_alpha(win: &WebviewWindow, value: f64) {
    let handle = win.clone();

    let _ = win.run_on_main_thread(move || {
        let Ok(raw) = handle.ns_window() else {
            return;
        };

        let window: &NSWindow = unsafe { &*raw.cast() };
        window.setAlphaValue(value);
    });
}
