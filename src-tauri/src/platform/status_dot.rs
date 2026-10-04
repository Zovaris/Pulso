use tauri::tray::TrayIcon;

/// Shows or hides the red dot on the menu bar icon. On macOS it sits on top of
/// the template image, so the icon keeps following the bar's light or dark
/// look while the dot stays red. Other platforms color their tray icons, so
/// they will draw it into the image when they arrive.
pub fn show(tray: &TrayIcon, visible: bool) {
    #[cfg(target_os = "macos")]
    let _ = tray.with_inner_tray_icon(move |inner| {
        if let Some(item) = inner.ns_status_item() {
            super::macos::status_dot::show(&item, visible);
        }
    });

    #[cfg(not(target_os = "macos"))]
    let _ = (tray, visible);
}
