use std::sync::atomic::{AtomicBool, Ordering};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// True while the native folder panel is on screen. The popover hides itself
/// when it loses focus, and the panel takes that focus, so the window handler
/// consults this flag before closing the popover.
static PICKER_OPEN: AtomicBool = AtomicBool::new(false);

pub fn is_open() -> bool {
    PICKER_OPEN.load(Ordering::SeqCst)
}

/// Opens the folder panel and resolves once it closes.
pub async fn pick_folder(app: &AppHandle, title: String) -> Option<String> {
    PICKER_OPEN.store(true, Ordering::SeqCst);

    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title(title)
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });

    // The panel runs on the main thread, so the wait happens off it.
    let picked = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .ok()
        .flatten();

    PICKER_OPEN.store(false, Ordering::SeqCst);

    picked
        .and_then(|folder| folder.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
}
