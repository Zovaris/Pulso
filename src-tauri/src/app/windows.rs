use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

use crate::events;
use crate::platform::macos::window;

use super::slide;

const FRAME: Duration = Duration::from_millis(16);

static SLIDES: slide::Generation = slide::Generation::new();

pub struct Motion {
    from: PhysicalPosition<i32>,
    to: PhysicalPosition<i32>,
    duration: Duration,
    fade: (f64, f64),
}

impl Motion {
    fn entering(from: PhysicalPosition<i32>, to: PhysicalPosition<i32>) -> Self {
        Self {
            from,
            to,
            duration: slide::ENTER,
            fade: (0.0, 1.0),
        }
    }

    fn leaving(from: PhysicalPosition<i32>, to: PhysicalPosition<i32>) -> Self {
        Self {
            from,
            to,
            duration: slide::EXIT,
            fade: (1.0, 0.0),
        }
    }

    fn position(&self, progress: f64) -> PhysicalPosition<i32> {
        let x = slide::between(f64::from(self.from.x), f64::from(self.to.x), progress);
        let y = slide::between(f64::from(self.from.y), f64::from(self.to.y), progress);

        PhysicalPosition::new(x.round() as i32, y.round() as i32)
    }

    fn alpha(&self, progress: f64) -> f64 {
        slide::between(self.fade.0, self.fade.1, progress)
    }
}

pub fn popover(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("popover")
}

pub fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

pub fn hide_popover(app: &AppHandle) {
    if let Some(win) = popover(app) {
        let _ = win.hide();
        window::set_alpha(&win, 1.0);
    }
}

pub fn close_popover(app: &AppHandle) {
    events::popover_closing(app);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut home = None;

        if let Some(win) = popover(&app) {
            if let Ok(from) = win.outer_position() {
                let to = slid(&win, from, slide::DISTANCE);

                if !slide_window(&win, Motion::leaving(from, to)).await {
                    return;
                }

                home = Some(from);
            }
        }

        hide_popover(&app);

        if let (Some(win), Some(home)) = (popover(&app), home) {
            let _ = win.set_position(home);
        }
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

pub fn stage_popover(win: &WebviewWindow, x: i32, y: i32, width: u32, height: u32) -> Motion {
    let settled = popover_origin(win, x, y, width, height);
    let from = slid(win, settled, slide::DISTANCE);

    let _ = win.set_position(from);
    window::set_alpha(win, 0.0);

    Motion::entering(from, settled)
}

fn popover_origin(
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

fn slid(
    win: &WebviewWindow,
    origin: PhysicalPosition<i32>,
    distance: f64,
) -> PhysicalPosition<i32> {
    let scale = win.scale_factor().unwrap_or(1.0);

    PhysicalPosition::new(origin.x, origin.y - (distance * scale).round() as i32)
}

pub async fn slide_window(win: &WebviewWindow, motion: Motion) -> bool {
    let generation = SLIDES.begin();

    for progress in slide::progressions(motion.duration, slide::STEP) {
        if !SLIDES.is_current(generation) {
            return false;
        }

        tokio::time::sleep(slide::STEP).await;

        let _ = win.set_position(motion.position(progress));
        window::set_alpha(win, motion.alpha(progress));
    }

    let _ = win.set_position(motion.to);
    window::set_alpha(win, motion.fade.1);

    true
}
