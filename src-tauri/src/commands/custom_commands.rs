use super::in_database;
use crate::persistence::{
    repositories::{self, custom_commands::CustomCommand},
    Database,
};
use crate::process::supervisor::ProcessSupervisor;
use crate::support::{
    error::{BackendError, ErrorKind, Result},
    paths,
};
use std::{path::Path, sync::Arc};
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
        command.cwd = resolve_cwd(conn, &command, &home)?;
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

fn resolve_cwd(
    conn: &rusqlite::Connection,
    command: &CustomCommand,
    home: &Path,
) -> Result<String> {
    let cwd = command.cwd.trim();
    let path = if cwd.is_empty() {
        if let Some(id) = command.project_id {
            let project = repositories::projects::by_id(conn, id)?.ok_or_else(|| {
                BackendError::new(ErrorKind::NotFound, "That project is no longer in Pulso.")
            })?;
            std::path::PathBuf::from(project.path)
        } else {
            home.to_path_buf()
        }
    } else if cwd == "~" {
        home.to_path_buf()
    } else if let Some(relative) = cwd.strip_prefix("~/") {
        home.join(relative)
    } else {
        std::path::PathBuf::from(cwd)
    };
    if !path.is_absolute() {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "Use an absolute folder path or ~.",
        ));
    }
    Ok(paths::as_string(&paths::canonical_dir(&path)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn folders_default_to_home_or_project_and_explicit_tilde_always_means_home() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../../migrations/0001_projects.sql"))
            .unwrap();
        let home = std::env::temp_dir();
        let project = std::env::current_dir().unwrap();
        conn.execute(
            "INSERT INTO projects (id, path, name, added_at) VALUES (1, ?1, 'Test', 1)",
            [project.to_string_lossy().as_ref()],
        )
        .unwrap();
        let mut command = CustomCommand {
            id: None,
            project_id: None,
            label: "Test".into(),
            command: "pwd".into(),
            cwd: String::new(),
            favorite: false,
        };
        assert_eq!(
            resolve_cwd(&conn, &command, &home).unwrap(),
            paths::as_string(&paths::canonical_dir(&home).unwrap())
        );
        command.project_id = Some(1);
        assert_eq!(
            resolve_cwd(&conn, &command, &home).unwrap(),
            paths::as_string(&paths::canonical_dir(&project).unwrap())
        );
        command.cwd = "~".into();
        assert_eq!(
            resolve_cwd(&conn, &command, &home).unwrap(),
            paths::as_string(&paths::canonical_dir(&home).unwrap())
        );
        command.cwd = "relative/folder".into();
        assert!(resolve_cwd(&conn, &command, &home).is_err());
        command.cwd = "/pulso/nonexistent/folder".into();
        assert!(resolve_cwd(&conn, &command, &home).is_err());
    }
}
