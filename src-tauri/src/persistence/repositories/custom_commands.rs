use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::domain::command::{CommandCategory, DetectedCommand};
use crate::persistence::storage_error;
use crate::support::error::{BackendError, ErrorKind, Result};
use crate::support::paths;
use std::path::{Path, PathBuf};

/// The existing execution API uses zero for personal commands; storage uses NULL.
pub const PERSONAL_SCOPE: i64 = 0;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomCommand {
    pub id: Option<i64>,
    pub project_id: Option<i64>,
    pub label: String,
    pub command: String,
    pub cwd: String,
    pub favorite: bool,
}

impl CustomCommand {
    pub fn detected(&self) -> DetectedCommand {
        DetectedCommand {
            id: format!("custom:{}", self.id.unwrap_or_default()),
            label: self.label.clone(),
            program: std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into()),
            args: vec!["-c".into(), self.command.clone()],
            cwd: self.cwd.clone(),
            source: "custom".into(),
            detector: "custom".into(),
            category: CommandCategory::Other,
            long_running: false,
        }
    }
}

fn row_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<CustomCommand> {
    Ok(CustomCommand {
        id: row.get(0)?,
        project_id: row.get(1)?,
        label: row.get(2)?,
        command: row.get(3)?,
        cwd: row.get(4)?,
        favorite: row.get(5)?,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<CustomCommand>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, label, command, cwd, favorite FROM custom_commands ORDER BY id",
        )
        .map_err(storage_error)?;
    let rows = stmt.query_map([], row_from).map_err(storage_error)?;
    rows.collect::<std::result::Result<_, _>>()
        .map_err(storage_error)
}

pub fn by_id(conn: &Connection, id: i64) -> Result<CustomCommand> {
    conn.query_row(
        "SELECT id, project_id, label, command, cwd, favorite FROM custom_commands WHERE id = ?1",
        [id],
        row_from,
    )
    .optional()
    .map_err(storage_error)?
    .ok_or_else(|| BackendError::new(ErrorKind::NotFound, "That command is no longer in Pulso."))
}

pub fn save(conn: &Connection, command: &CustomCommand) -> Result<()> {
    if let Some(id) = command.id {
        let changed = conn.execute("UPDATE custom_commands SET project_id=?2, label=?3, command=?4, cwd=?5, favorite=?6 WHERE id=?1",
            params![id, command.project_id, command.label, command.command, command.cwd, command.favorite]).map_err(storage_error)?;
        if changed == 0 {
            return Err(BackendError::new(
                ErrorKind::NotFound,
                "That command is no longer in Pulso.",
            ));
        }
    } else {
        conn.execute("INSERT INTO custom_commands (project_id, label, command, cwd, favorite) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![command.project_id, command.label, command.command, command.cwd, command.favorite]).map_err(storage_error)?;
    }
    Ok(())
}

/// The folder a custom command runs in: the project (or home) when left empty,
/// `~` expanded, and the result canonical so the same folder is stored once.
pub fn resolve_cwd(conn: &Connection, command: &CustomCommand, home: &Path) -> Result<String> {
    let cwd = command.cwd.trim();
    let path = if cwd.is_empty() {
        if let Some(id) = command.project_id {
            let project =
                crate::persistence::repositories::projects::by_id(conn, id)?.ok_or_else(|| {
                    BackendError::new(ErrorKind::NotFound, "That project is no longer in Pulso.")
                })?;
            PathBuf::from(project.path)
        } else {
            home.to_path_buf()
        }
    } else if cwd == "~" {
        home.to_path_buf()
    } else if let Some(relative) = cwd.strip_prefix("~/") {
        home.join(relative)
    } else {
        PathBuf::from(cwd)
    };
    if !path.is_absolute() {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "Use an absolute folder path or ~.",
        ));
    }
    Ok(paths::as_string(&paths::canonical_dir(&path)?))
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    if conn
        .execute("DELETE FROM custom_commands WHERE id=?1", [id])
        .map_err(storage_error)?
        == 0
    {
        return Err(BackendError::new(
            ErrorKind::NotFound,
            "That command is no longer in Pulso.",
        ));
    }
    Ok(())
}

pub fn augment_scan(
    conn: &Connection,
    mut scan: crate::domain::command::CommandScan,
) -> Result<crate::domain::command::CommandScan> {
    use crate::domain::command::{CommandFlags, ScanStatus};
    for command in list(conn)?
        .into_iter()
        .filter(|command| command.project_id == Some(scan.project_id))
    {
        let detected = command.detected();
        let hidden = scan
            .flags
            .get(&detected.id)
            .is_some_and(|flags| flags.hidden);
        scan.flags.insert(
            detected.id.clone(),
            CommandFlags {
                favorite: command.favorite,
                hidden,
            },
        );
        scan.commands.push(detected);
    }
    if !scan.commands.is_empty() {
        scan.status = ScanStatus::Detected;
    }
    Ok(scan)
}
