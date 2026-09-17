use std::sync::atomic::{AtomicBool, Ordering};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

static PICKER_OPEN: AtomicBool = AtomicBool::new(false);

pub fn is_open() -> bool {
    PICKER_OPEN.load(Ordering::SeqCst)
}

/// Where to write something the user asked to keep. `None` means they cancelled.
pub async fn save_file(app: &AppHandle, name: String) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_file_name(name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .ok()
        .flatten()
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
}

pub async fn open_file(app: &AppHandle, title: String) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().set_title(title).pick_file(move |path| {
        let _ = tx.send(path);
    });

    tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .ok()
        .flatten()
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
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
