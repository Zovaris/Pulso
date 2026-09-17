use std::path::Path;
use std::sync::Arc;

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::detectors;
use crate::domain::command::DetectedCommand;
use crate::domain::execution::Execution;
use crate::domain::log::LogSnapshot;
use crate::persistence::{repositories, Database};
use crate::process::supervisor::ProcessSupervisor;
use crate::support::error::{BackendError, ErrorKind, Result};

use super::{in_database, off_thread};

const TAIL: usize = 200;

#[tauri::command]
pub async fn list_executions(
    supervisor: State<'_, Arc<ProcessSupervisor>>,
) -> Result<Vec<Execution>> {
    Ok(supervisor.list())
}

#[tauri::command]
pub async fn start_command(
    db: State<'_, Arc<Database>>,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    project_id: i64,
    command_id: String,
) -> Result<Execution> {
    let command = resolve_command(&db, project_id, &command_id).await?;

    supervisor.start(project_id, &command, None).await
}

#[tauri::command]
pub async fn clear_finished(
    supervisor: State<'_, Arc<ProcessSupervisor>>,
) -> Result<Vec<Execution>> {
    supervisor.clear_finished();

    Ok(supervisor.list())
}

#[tauri::command]
pub async fn stop_execution(
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    execution_id: i64,
) -> Result<Execution> {
    supervisor.stop(execution_id).await
}

#[tauri::command]
pub async fn get_log_snapshot(
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    execution_id: i64,
    after_seq: Option<u64>,
) -> Result<LogSnapshot> {
    supervisor.logs(execution_id, after_seq, TAIL)
}

#[tauri::command]
pub async fn open_detected_url(
    app: AppHandle,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    execution_id: i64,
    port_id: String,
) -> Result<()> {
    let url = supervisor.url(execution_id, &port_id)?;

    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| BackendError::internal(format!("The browser did not open: {error}")))
}

async fn resolve_command(
    db: &State<'_, Arc<Database>>,
    project_id: i64,
    command_id: &str,
) -> Result<DetectedCommand> {
    let project = in_database(db, move |conn| {
        repositories::projects::by_id(conn, project_id)
    })
    .await?
    .ok_or_else(|| BackendError::new(ErrorKind::NotFound, "That project is no longer in Pulso."))?;

    let path = project.path;
    let scan = off_thread(move || detectors::scan(project_id, Path::new(&path))).await?;

    scan.commands
        .into_iter()
        .find(|command| command.id == command_id)
        .ok_or_else(|| {
            BackendError::new(
                ErrorKind::NotFound,
                format!("{command_id} is not in that project any more."),
            )
        })
}
