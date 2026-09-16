use rusqlite::{params, Connection};

use crate::domain::project::{Availability, Project};
use crate::persistence::storage_error;
use crate::support::error::{BackendError, Result};
use crate::support::paths;

/// A row exactly as SQLite stores it. Availability is deliberately absent from
/// the table and resolved when the row becomes a `Project`.
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

/// Add or return. Picking a folder Soffy already knows is not an error: the row
/// that is already there is the answer, which is what makes a second pick of the
/// same folder (or of a symlink to it) a no-op.
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
mod tests {
    use super::*;
    use crate::domain::project::Availability;
    use crate::persistence::Database;
    use crate::support::now_ms;

    /// A real database in a temporary file, removed when the test ends. The
    /// point is to exercise the migration and the SQL, not a stub.
    struct TempDatabase {
        database: Database,
        path: std::path::PathBuf,
    }

    impl TempDatabase {
        /// The name keeps parallel tests in separate files; the timestamp keeps
        /// a rerun from meeting the previous file.
        fn open(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "soffy-test-{name}-{}-{}.db",
                std::process::id(),
                now_ms()
            ));
            let database = Database::open(&path).expect("a fresh database should open");
            Self { database, path }
        }
    }

    impl Drop for TempDatabase {
        fn drop(&mut self) {
            for suffix in ["", "-wal", "-shm"] {
                let _ = std::fs::remove_file(format!("{}{suffix}", self.path.display()));
            }
        }
    }

    #[test]
    fn the_same_folder_is_stored_once() {
        let temp = TempDatabase::open("once");

        let (first, second) = temp
            .database
            .with(|conn| {
                let first = ensure(conn, "/tmp/one", "one", 1)?;
                let second = ensure(conn, "/tmp/one", "one", 2)?;
                Ok((first, second))
            })
            .expect("the same path should be accepted twice");

        assert_eq!(first.id, second.id);

        let projects = temp.database.with(list).expect("the list should read");
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, first.id);
    }

    #[test]
    fn a_folder_that_is_not_there_reads_as_missing() {
        let temp = TempDatabase::open("missing");

        let missing = temp
            .database
            .with(|conn| ensure(conn, "/soffy/does/not/exist", "exist", 1))
            .map(ProjectRow::into_project)
            .expect("storing is not validation");

        assert_eq!(missing.availability, Availability::Missing);

        let available = temp
            .database
            .with(|conn| {
                ensure(
                    conn,
                    &crate::support::paths::as_string(&std::env::temp_dir()),
                    "temp",
                    2,
                )
            })
            .map(ProjectRow::into_project)
            .expect("the temp folder exists");

        assert_eq!(available.availability, Availability::Available);
    }

    #[test]
    fn removing_a_project_is_reported_and_leaves_the_others_alone() {
        let temp = TempDatabase::open("removal");

        let outcome = temp
            .database
            .with(|conn| {
                let keep = ensure(conn, "/tmp/keep", "keep", 1)?;
                let forgotten = ensure(conn, "/tmp/drop", "drop", 2)?;
                let removed = delete(conn, forgotten.id)?;
                let again = delete(conn, forgotten.id)?;
                let rest = list(conn)?;
                Ok((keep.id, removed, again, rest))
            })
            .expect("the operations should run");

        let (kept_id, removed, again, rest) = outcome;
        assert!(removed);
        assert!(!again, "deleting twice is reported as nothing removed");
        assert_eq!(rest.len(), 1);
        assert_eq!(rest[0].id, kept_id);
    }

    #[test]
    fn settings_are_read_back_after_being_written() {
        use crate::persistence::repositories::settings;

        let temp = TempDatabase::open("settings");

        let value = temp
            .database
            .with(|conn| {
                assert_eq!(settings::get(conn, "appearance.theme")?, None);
                settings::set(conn, "appearance.theme", "dark")?;
                settings::set(conn, "appearance.theme", "light")?;
                settings::get(conn, "appearance.theme")
            })
            .expect("settings should round trip");

        assert_eq!(value.as_deref(), Some("light"));
    }
}
