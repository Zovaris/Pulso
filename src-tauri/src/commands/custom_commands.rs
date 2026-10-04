use super::in_database;
use crate::persistence::{
    repositories::{self, custom_commands::CustomCommand},
    Database,
};
use crate::process::supervisor::ProcessSupervisor;
use crate::support::error::{BackendError, ErrorKind, Result};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub async fn list_custom_commands(db: State<'_, Arc<Database>>) -> Result<Vec<CustomCommand>> {
    in_database(&db, repositories::custom_commands::list).await
}

fn ensure_idle(app: &AppHandle, id: Option<i64>) -> Result<()> {
    if let Some(id) = id {
        let supervisor = app.state::<Arc<ProcessSupervisor>>();
        if supervisor
            .list()
            .iter()
            .any(|run| run.command_id == format!("custom:{id}") && run.is_active())
        {
            return Err(BackendError::new(
                ErrorKind::InvalidInput,
                "Stop this command before editing or removing it.",
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_custom_command(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    mut command: CustomCommand,
) -> Result<Vec<CustomCommand>> {
    ensure_idle(&app, command.id)?;
    command.label = command.label.trim().into();
    command.command = command.command.trim().into();
    if command.label.is_empty() || command.command.is_empty() || command.command.contains('\0') {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "Give the command a name and a valid shell command.",
        ));
    }
    let home = app
        .path()
        .home_dir()
        .map_err(|e| BackendError::internal(e.to_string()))?;
    let commands = in_database(&db, move |conn| {
        command.cwd = repositories::custom_commands::resolve_cwd(conn, &command, &home)?;
        repositories::custom_commands::save(conn, &command)?;
        repositories::custom_commands::list(conn)
    })
    .await?;
    let _ = app.emit("custom-command://changed", &commands);
    crate::events::refresh(&app).await;
    Ok(commands)
}

#[tauri::command]
pub async fn delete_custom_command(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    id: i64,
) -> Result<Vec<CustomCommand>> {
    ensure_idle(&app, Some(id))?;
    let commands = in_database(&db, move |conn| {
        repositories::custom_commands::delete(conn, id)?;
        repositories::custom_commands::list(conn)
    })
    .await?;
    let _ = app.emit("custom-command://changed", &commands);
    crate::events::refresh(&app).await;
    Ok(commands)
}
