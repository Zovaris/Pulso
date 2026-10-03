use std::sync::Arc;

use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

use crate::domain::port::{ListeningPort, PortTarget};
use crate::process::{listeners, supervisor::ProcessSupervisor};
use crate::support::error::{BackendError, ErrorKind, Result};

fn desktop(window: &WebviewWindow) -> Result<()> {
    if window.label() != "main" {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "Port management is only available in the desktop window.",
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_listening_ports(
    window: WebviewWindow,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
) -> Result<Vec<ListeningPort>> {
    desktop(&window)?;
    listeners::scan(&supervisor.live_groups()).await
}

#[tauri::command]
pub async fn stop_port_process(
    window: WebviewWindow,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    target: PortTarget,
) -> Result<()> {
    desktop(&window)?;
    let ports = listeners::scan(&supervisor.live_groups()).await?;
    let entry = listeners::validate(&ports, &target)?;
    if !entry.can_stop {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "This process cannot be stopped by Pulso.",
        ));
    }
    if let Some(id) = entry.execution_id {
        // Pulso-owned children stop through the supervisor, preserving group
        // cleanup, logs, history and the menubar's execution state.
        supervisor.stop(id).await?;
    } else {
        listeners::terminate(entry)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_listening_port(
    window: WebviewWindow,
    app: AppHandle,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    target: PortTarget,
) -> Result<()> {
    desktop(&window)?;
    let ports = listeners::scan(&supervisor.live_groups()).await?;
    let entry = listeners::validate(&ports, &target)?;
    // Explicitly an HTTP attempt, not protocol detection. Only open a numeric
    // loopback URL constructed here, never arbitrary data from process names.
    let host = if entry.address.starts_with('[') {
        "[::1]"
    } else {
        "127.0.0.1"
    };
    app.opener()
        .open_url(format!("http://{host}:{}/", entry.port), None::<&str>)
        .map_err(|error| BackendError::internal(format!("The browser did not open: {error}")))
}
