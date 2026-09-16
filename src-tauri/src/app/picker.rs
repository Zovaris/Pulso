use std::sync::atomic::{AtomicBool, Ordering};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

static PICKER_OPEN: AtomicBool = AtomicBool::new(false);

pub fn is_open() -> bool {
    PICKER_OPEN.load(Ordering::SeqCst)
}

pub async fn pick_folder(app: &AppHandle, title: String) -> Option<String> {
    PICKER_OPEN.store(true, Ordering::SeqCst);

    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title(title)
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });

    let picked = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .ok()
        .flatten();

    PICKER_OPEN.store(false, Ordering::SeqCst);

    picked
        .and_then(|folder| folder.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
}
