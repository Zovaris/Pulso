use rusqlite::{params, Connection};

use crate::domain::project::{Availability, Project};
use crate::persistence::storage_error;
use crate::support::error::{BackendError, Result};
use crate::support::paths;

#[derive(Debug, Clone)]
pub struct ProjectRow {
    pub id: i64,
    pub path: String,
    pub name: String,
}

impl ProjectRow {
    pub fn into_project(self) -> Project {
        let availability = if paths::is_available(&self.path) {
            Availability::Available
        } else {
            Availability::Missing
        };

        Project {
            id: self.id,
            name: self.name,
            path: self.path,
            availability,
        }
    }
}

const COLUMNS: &str = "id, path, name";

pub fn list(conn: &Connection) -> Result<Vec<Project>> {
    let mut statement = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM projects ORDER BY added_at, id"
        ))
        .map_err(storage_error)?;

    let rows = statement
        .query_map([], row_from)
        .map_err(storage_error)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(storage_error)?;

    Ok(rows.into_iter().map(ProjectRow::into_project).collect())
}

pub fn by_id(conn: &Connection, id: i64) -> Result<Option<ProjectRow>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM projects WHERE id = ?1"),
        params![id],
        row_from,
    )
    .map(Some)
    .or_else(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(storage_error(other)),
    })
}

fn by_path(conn: &Connection, path: &str) -> Result<Option<ProjectRow>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM projects WHERE path = ?1"),
        params![path],
        row_from,
    )
    .map(Some)
    .or_else(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(storage_error(other)),
    })
}

pub fn ensure(conn: &Connection, path: &str, name: &str, added_at: i64) -> Result<ProjectRow> {
    conn.execute(
        "INSERT INTO projects (path, name, added_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(path) DO NOTHING",
        params![path, name, added_at],
    )
    .map_err(storage_error)?;

    by_path(conn, path)?.ok_or_else(|| {
        BackendError::internal("The project was accepted but could not be read back.")
    })
}

pub fn delete(conn: &Connection, id: i64) -> Result<bool> {
    let removed = conn
        .execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(storage_error)?;

    Ok(removed > 0)
}

fn row_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectRow> {
    Ok(ProjectRow {
        id: row.get(0)?,
        path: row.get(1)?,
        name: row.get(2)?,
    })
}

#[cfg(test)]
mod tests;
