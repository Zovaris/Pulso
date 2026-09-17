use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::support::error::{BackendError, ErrorKind, Result};

const MIGRATIONS: &[&str] = &[
    include_str!("../../migrations/0001_projects.sql"),
    include_str!("../../migrations/0002_command_flags.sql"),
    include_str!("../../migrations/0003_execution_history.sql"),
];

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                BackendError::at(
                    ErrorKind::Storage,
                    parent,
                    format!("The data folder could not be created: {error}"),
                )
            })?;
        }

        let conn = Connection::open(path).map_err(|error| {
            BackendError::at(
                ErrorKind::Storage,
                path,
                format!("The database could not be opened: {error}"),
            )
        })?;

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;",
        )
        .map_err(|error| {
            BackendError::storage(format!("The database could not be prepared: {error}"))
        })?;

        migrate(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn with<T>(&self, work: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| BackendError::storage("The database lock was poisoned."))?;
        work(&conn)
    }
}

fn migrate(conn: &Connection) -> Result<()> {
    let applied: usize = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .map(|version| version.max(0) as usize)
        .map_err(|error| {
            BackendError::storage(format!("The schema version could not be read: {error}"))
        })?;

    for (index, migration) in MIGRATIONS.iter().enumerate().skip(applied) {
        let version = index + 1;
        conn.execute_batch("BEGIN;").map_err(|error| {
            BackendError::storage(format!("Migration {version} could not start: {error}"))
        })?;

        let step = conn
            .execute_batch(migration)
            .and_then(|()| conn.execute_batch(&format!("PRAGMA user_version = {version};")));

        match step {
            Ok(()) => conn.execute_batch("COMMIT;").map_err(|error| {
                BackendError::storage(format!(
                    "Migration {version} could not be committed: {error}"
                ))
            })?,
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(BackendError::storage(format!(
                    "Migration {version} failed: {error}"
                )));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests;
