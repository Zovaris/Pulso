pub mod executions;
pub mod projects;
pub mod settings;
pub mod tray;
pub mod window;

use std::sync::Arc;

use rusqlite::Connection;
use tauri::State;

use crate::persistence::Database;
use crate::support::error::{BackendError, Result};

pub async fn in_database<T, F>(db: &State<'_, Arc<Database>>, work: F) -> Result<T>
where
    F: FnOnce(&Connection) -> Result<T> + Send + 'static,
    T: Send + 'static,
{
    let database = Arc::clone(db.inner());

    tauri::async_runtime::spawn_blocking(move || database.with(work))
        .await
        .map_err(|_| BackendError::internal("The database task did not finish."))?
}

pub async fn off_thread<T, F>(work: F) -> Result<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| BackendError::internal("The task did not finish."))
}
