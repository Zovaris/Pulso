use std::sync::{Arc, Mutex};

use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, PhysicalSize,
};

use crate::commands::settings::{stored_locale, Locale};
use crate::events;
use crate::process::supervisor::ProcessSupervisor;

use super::windows;

const TRAY_PNG: &[u8] = include_bytes!("../../../assets/brand/soffy-tray.png");
const TRAY_ID: &str = "soffy";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Shown {
    running: usize,
    locale: Locale,
}

static SHOWN: Mutex<Option<Shown>> = Mutex::new(None);

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(TRAY_PNG).expect("tray png");

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip(label(0, Locale::En))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                let app = tray.app_handle();
                let scale = windows::popover(app)
                    .and_then(|w| w.scale_factor().ok())
                    .unwrap_or(1.0);
                let pos: PhysicalPosition<f64> = rect.position.to_physical(scale);
                let size: PhysicalSize<f64> = rect.size.to_physical(scale);
                toggle_popover(
                    app,
                    pos.x as i32,
                    pos.y as i32,
                    size.width as u32,
                    size.height as u32,
                );
            }
        })
        .build(app)?;

    sync(app);

    Ok(())
}

pub fn set_badge(app: &AppHandle, png: Option<&[u8]>) -> tauri::Result<()> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };

    let icon = match png {
        Some(bytes) => Image::from_bytes(bytes)?,
        None => Image::from_bytes(TRAY_PNG).expect("tray png"),
    };

    tray.set_icon_with_as_template(Some(icon), true)
}

pub fn sync(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };

    let running = running_count(app);
    let locale = stored_locale(app);

    let Ok(mut shown) = SHOWN.lock() else {
        return;
    };
    if *shown == Some(Shown { running, locale }) {
        return;
    }
    *shown = Some(Shown { running, locale });
    drop(shown);

    let _ = tray.set_tooltip(Some(label(running, locale)));
}

pub fn label(running: usize, locale: Locale) -> String {
    let sentence = match (locale, running) {
        (Locale::En, 0) => "no processes running".to_string(),
        (Locale::En, 1) => "one process running".to_string(),
        (Locale::En, n) => format!("{n} processes running"),
        (Locale::Es, 0) => "sin procesos activos".to_string(),
        (Locale::Es, 1) => "un proceso activo".to_string(),
        (Locale::Es, n) => format!("{n} procesos activos"),
    };

    format!("Soffy — {sentence}")
}

fn running_count(app: &AppHandle) -> usize {
    let Some(supervisor) = app.try_state::<Arc<ProcessSupervisor>>() else {
        return 0;
    };

    supervisor
        .list()
        .iter()
        .filter(|execution| execution.is_active())
        .count()
}

fn toggle_popover(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) {
    let Some(win) = windows::popover(app) else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        windows::close_popover(app);
        return;
    }

    windows::position_popover(&win, x, y, width, height);
    events::popover_prepare(app);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        windows::await_first_frame().await;
        if let Some(win) = windows::popover(&app) {
            let _ = win.show();
            let _ = win.set_focus();
        }
        events::popover_shown(&app);
        events::refresh(&app).await;
    });
}

#[cfg(test)]
mod tests;
