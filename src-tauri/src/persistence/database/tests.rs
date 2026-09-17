use super::*;
use crate::persistence::storage_error;

fn temp_path(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "pulso-{name}-{}-{}.db",
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
