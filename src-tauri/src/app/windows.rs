use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

use crate::events;

const FRAME: Duration = Duration::from_millis(16);
const CLOSE: Duration = Duration::from_millis(130);

pub fn popover(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("popover")
}

pub fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

pub fn hide_popover(app: &AppHandle) {
    if let Some(win) = popover(app) {
        let _ = win.hide();
    }
}

pub fn close_popover(app: &AppHandle) {
    events::popover_closing(app);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(CLOSE).await;
        hide_popover(&app);
    });
}

pub async fn await_first_frame() {
    tokio::time::sleep(FRAME).await;
}

pub fn hide_main(app: &AppHandle) {
    if let Some(win) = main_window(app) {
        let _ = win.hide();
    }
}

pub fn show_main(app: &AppHandle) -> bool {
    let Some(win) = main_window(app) else {
        return false;
    };

    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_focus();

    let app = app.clone();
    tauri::async_runtime::spawn(async move { crate::events::refresh(&app).await });

    true
}

pub fn position_popover(win: &WebviewWindow, x: i32, y: i32, width: u32, height: u32) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let size = win.outer_size().ok();
    let win_w = size.map(|s| f64::from(s.width)).unwrap_or(380.0 * scale);
    let left = f64::from(x) + f64::from(width) / 2.0 - win_w / 2.0;
    let top = f64::from(y) + f64::from(height) + 4.0 * scale;
    let _ = win.set_position(PhysicalPosition::new(
        left.round() as i32,
        top.round() as i32,
    ));
}
