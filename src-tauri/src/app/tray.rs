use std::sync::{Arc, Mutex};

use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, PhysicalSize,
};

use crate::commands::settings::{stored_locale, Locale};
use crate::events;
use crate::process::supervisor::ProcessSupervisor;

use super::{attention, windows};
use crate::platform;

const TRAY_PNG: &[u8] = include_bytes!("../../../assets/brand/pulso-tray.png");
const TRAY_ID: &str = "pulso";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Shown {
    running: usize,
    locale: Locale,
    attention: bool,
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

    tray.set_icon_with_as_template(Some(icon), true)?;
    platform::status_dot::show(&tray, attention_shown());
    Ok(())
}

fn attention_shown() -> bool {
    SHOWN
        .lock()
        .ok()
        .and_then(|shown| shown.map(|shown| shown.attention))
        .unwrap_or(false)
}

pub fn sync(app: &AppHandle) {
    if app.tray_by_id(TRAY_ID).is_none() {
        return;
    }

    let executions = app
        .try_state::<Arc<ProcessSupervisor>>()
        .map(|supervisor| supervisor.list())
        .unwrap_or_default();
    let next = Shown {
        running: executions
            .iter()
            .filter(|execution| execution.is_active())
            .count(),
        locale: stored_locale(app),
        attention: attention::unseen(&executions, attention::seen_at()) > 0,
    };

    let Ok(mut shown) = SHOWN.lock() else {
        return;
    };
    let previous = shown.replace(next);
    drop(shown);
    if previous == Some(next) {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(tray) = app.tray_by_id(TRAY_ID) else {
            return;
        };
        let _ = tray.set_tooltip(Some(label(next.running, next.locale)));
        if previous.map(|shown| shown.attention) != Some(next.attention) {
            platform::status_dot::show(&tray, next.attention);
        }
    });
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

    format!("Pulso — {sentence}")
}

fn toggle_popover(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) {
    let Some(win) = windows::popover(app) else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        windows::close_popover(app);
        return;
    }

    let motion = windows::stage_popover(&win, x, y, width, height);
    events::popover_prepare(app);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        windows::await_first_frame().await;
        if let Some(win) = windows::popover(&app) {
            let _ = win.show();
            let _ = win.set_focus();
        }
        events::popover_shown(&app);
        if let Some(win) = windows::popover(&app) {
            windows::slide_window(&win, motion).await;
        }
        events::refresh(&app).await;
    });
}

#[cfg(test)]
mod tests;
