use super::*;
use crate::domain::project::Availability;
use crate::persistence::Database;
use crate::support::now_ms;

struct TempDatabase {
    database: Database,
    path: std::path::PathBuf,
}

impl TempDatabase {
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
