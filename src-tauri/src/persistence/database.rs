use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::support::error::{BackendError, ErrorKind, Result};

/// Applied in order and tracked with SQLite's own `user_version`, so a schema
/// change is a new file here and nothing else.
const MIGRATIONS: &[&str] = &[include_str!("../../migrations/0001_projects.sql")];

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

        // WAL keeps a read from blocking a write; the busy timeout covers the
        // moment two commands meet.
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

    /// `rusqlite` is synchronous, so callers reach this through the blocking
    /// pool: a slow query on the main thread freezes the window that asked.
    pub fn with<T>(&self, work: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| BackendError::storage("The database lock was poisoned."))?;
        work(&conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::storage_error;

    fn temp_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "soffy-{name}-{}-{}.db",
            std::process::id(),
            crate::support::now_ms()
        ))
    }

    fn remove(path: &Path) {
        for suffix in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{suffix}", path.display()));
        }
    }

    #[test]
    fn reopening_a_database_reapplies_nothing_and_keeps_the_data() {
        let path = temp_path("migrate");

        {
            let database = Database::open(&path).expect("a fresh database should open");
            database
                .with(|conn| {
                    conn.execute(
                        "INSERT INTO projects (path, name, added_at) VALUES ('/tmp/one', 'one', 1)",
                        [],
                    )
                    .map_err(storage_error)?;
                    Ok(())
                })
                .expect("the row should insert");
        }

        let reopened = Database::open(&path).expect("reopening must not rerun a migration");
        let version = reopened
            .with(|conn| {
                conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                    .map_err(storage_error)
            })
            .expect("the version should read");
        assert_eq!(version, MIGRATIONS.len() as i64);

        let rows = reopened
            .with(|conn| {
                conn.query_row("SELECT COUNT(*) FROM projects", [], |row| {
                    row.get::<_, i64>(0)
                })
                .map_err(storage_error)
            })
            .expect("the count should read");
        assert_eq!(rows, 1, "the data survives a reopen");

        remove(&path);
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
