use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

use crate::events;

use super::slide;

const FRAME: Duration = Duration::from_millis(16);

static SLIDES: slide::Generation = slide::Generation::new();

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
        if let Some(win) = popover(&app) {
            let Ok(from) = win.outer_position() else {
                hide_popover(&app);
                return;
            };
            let to = slid(&win, from, slide::DISTANCE);

            if !slide_window(&win, from, to, slide::EXIT).await {
                return;
            }
        }

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

pub fn popover_origin(
    win: &WebviewWindow,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> PhysicalPosition<i32> {
    let scale = win.scale_factor().unwrap_or(1.0);
    let size = win.outer_size().ok();
    let win_w = size.map(|s| f64::from(s.width)).unwrap_or(380.0 * scale);
    let left = f64::from(x) + f64::from(width) / 2.0 - win_w / 2.0;
    let top = f64::from(y) + f64::from(height) + 4.0 * scale;

    PhysicalPosition::new(left.round() as i32, top.round() as i32)
}

pub fn slid(
    win: &WebviewWindow,
    origin: PhysicalPosition<i32>,
    distance: f64,
) -> PhysicalPosition<i32> {
    let scale = win.scale_factor().unwrap_or(1.0);

    PhysicalPosition::new(origin.x, origin.y - (distance * scale).round() as i32)
}

pub async fn slide_window(
    win: &WebviewWindow,
    from: PhysicalPosition<i32>,
    to: PhysicalPosition<i32>,
    duration: Duration,
) -> bool {
    let generation = SLIDES.begin();

    for progress in slide::progressions(duration, slide::STEP) {
        if !SLIDES.is_current(generation) {
            return false;
        }

        tokio::time::sleep(slide::STEP).await;

        let x = f64::from(from.x) + f64::from(to.x - from.x) * progress;
        let y = f64::from(from.y) + f64::from(to.y - from.y) * progress;

        let _ = win.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
    }

    let _ = win.set_position(to);

    true
}
