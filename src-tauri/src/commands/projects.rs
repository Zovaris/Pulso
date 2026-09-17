use std::path::Path;
use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::domain::command::{CommandFlags, CommandScan};
use crate::domain::project::Project;
use crate::events;
use crate::persistence::repositories::{self, flags::FlagsByCommand};
use crate::persistence::Database;
use crate::support::error::{BackendError, ErrorKind, Result};
use crate::support::{now_ms, paths};

use super::{in_database, off_thread};

#[tauri::command]
pub async fn list_projects(db: State<'_, Arc<Database>>) -> Result<Vec<Project>> {
    in_database(&db, repositories::projects::list).await
}

#[tauri::command]
pub async fn add_project(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    path: String,
) -> Result<Project> {
    let project = in_database(&db, move |conn| {
        let canonical = paths::canonical_dir(Path::new(&path))?;
        let row = repositories::projects::ensure(
            conn,
            &paths::as_string(&canonical),
            &paths::display_name(&canonical),
            now_ms(),
        )?;

        Ok(row.into_project())
    })
    .await?;

    events::broadcast_projects(&app).await;

    Ok(project)
}

#[tauri::command]
pub async fn remove_project(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    project_id: i64,
) -> Result<()> {
    let removed = in_database(&db, move |conn| {
        repositories::projects::delete(conn, project_id)
    })
    .await?;

    if !removed {
        return Err(BackendError::new(
            ErrorKind::NotFound,
            "That project is no longer in Pulso.",
        ));
    }

    events::broadcast_projects(&app).await;

    Ok(())
}

#[tauri::command]
pub async fn rescan_projects(app: AppHandle) -> Result<()> {
    events::refresh(&app).await;

    Ok(())
}

#[tauri::command]
pub async fn list_commands(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    project_id: i64,
) -> Result<CommandScan> {
    let scan = scan_project(&db, project_id).await?;

    events::commands_changed(&app, &scan);

    Ok(scan)
}

#[tauri::command]
pub async fn rescan_project(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    project_id: i64,
) -> Result<CommandScan> {
    let scan = scan_project(&db, project_id).await?;

    events::commands_changed(&app, &scan);

    Ok(scan)
}

#[tauri::command]
pub async fn set_command_flag(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    project_id: i64,
    command_id: String,
    favorite: bool,
    hidden: bool,
) -> Result<FlagsByCommand> {
    let flags = in_database(&db, move |conn| {
        repositories::flags::set(
            conn,
            project_id,
            &command_id,
            CommandFlags { favorite, hidden },
        )?;

        repositories::flags::for_project(conn, project_id)
    })
    .await?;

    events::command_flags_changed(&app, project_id, &flags);

    Ok(flags)
}

async fn scan_project(db: &State<'_, Arc<Database>>, project_id: i64) -> Result<CommandScan> {
    let project = in_database(db, move |conn| {
        repositories::projects::by_id(conn, project_id)
    })
    .await?
    .ok_or_else(|| BackendError::new(ErrorKind::NotFound, "That project is no longer in Pulso."))?;

    let path = project.path;
    let scan = off_thread(move || crate::detectors::scan(project_id, Path::new(&path))).await?;

    let flags = in_database(db, move |conn| {
        repositories::flags::for_project(conn, project_id)
    })
    .await?;

    Ok(scan.with_flags(flags))
}
