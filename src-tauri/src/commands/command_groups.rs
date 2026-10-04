use super::in_database;
use crate::persistence::{
    repositories::{self, command_groups::CommandGroup},
    Database,
};
use crate::support::error::Result;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn list_command_groups(db: State<'_, Arc<Database>>) -> Result<Vec<CommandGroup>> {
    in_database(&db, repositories::command_groups::list).await
}

#[tauri::command]
pub async fn save_command_group(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    group: CommandGroup,
) -> Result<Vec<CommandGroup>> {
    let group = repositories::command_groups::normalized(group)?;
    let groups = in_database(&db, move |conn| {
        repositories::command_groups::save(conn, &group)?;
        repositories::command_groups::list(conn)
    })
    .await?;
    let _ = app.emit("command-group://changed", &groups);
    Ok(groups)
}

#[tauri::command]
pub async fn delete_command_group(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    id: i64,
) -> Result<Vec<CommandGroup>> {
    let groups = in_database(&db, move |conn| {
        repositories::command_groups::delete(conn, id)?;
        repositories::command_groups::list(conn)
    })
    .await?;
    let _ = app.emit("command-group://changed", &groups);
    Ok(groups)
}
