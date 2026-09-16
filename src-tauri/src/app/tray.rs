use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, PhysicalPosition, PhysicalSize,
};

use crate::events;

use super::windows;

const TRAY_PNG: &[u8] = include_bytes!("../../../assets/brand/soffy-tray.png");

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(TRAY_PNG).expect("tray png");

    let _tray = TrayIconBuilder::with_id("soffy")
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Soffy")
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

    Ok(())
}

fn toggle_popover(app: &AppHandle, x: i32, y: i32, width: u32, height: u32) {
    let Some(win) = windows::popover(app) else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }
    windows::position_popover(&win, x, y, width, height);
    let _ = win.show();
    let _ = win.set_focus();
    events::popover_shown(app);

    let app = app.clone();
    tauri::async_runtime::spawn(async move { events::refresh(&app).await });
}
