use super::*;
use crate::domain::command::CommandFlags;
use crate::persistence::database::Database;

fn database() -> Database {
    let path = std::env::temp_dir().join(format!(
        "pulso-flags-{}-{:?}.db",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    let _ = std::fs::remove_file(&path);

    Database::open(&path).expect("the database opens")
}

fn seed(conn: &Connection) -> i64 {
    conn.execute(
        "INSERT INTO projects (path, name, added_at) VALUES ('/tmp/one', 'one', 1)",
        [],
    )
    .expect("the project is inserted");

    conn.last_insert_rowid()
}

fn flags(favorite: bool, hidden: bool) -> CommandFlags {
    CommandFlags { favorite, hidden }
}

#[test]
fn a_command_without_flags_is_absent() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn))).unwrap();

    let read = db
        .with(|conn| for_project(conn, project_id))
        .expect("the flags are readable");

    assert!(read.is_empty());
}

#[test]
fn flags_survive_a_round_trip() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn))).unwrap();

    db.with(|conn| {
        set(conn, project_id, "package_json:dev", flags(true, false))?;
        set(conn, project_id, "package_json:seed", flags(false, true))
    })
    .expect("the flags are written");

    let read = db
        .with(|conn| for_project(conn, project_id))
        .expect("the flags are readable");

    assert_eq!(read.len(), 2);
    assert!(read["package_json:dev"].favorite);
    assert!(!read["package_json:dev"].hidden);
    assert!(read["package_json:seed"].hidden);
}

#[test]
fn clearing_both_flags_removes_the_row() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn))).unwrap();

    db.with(|conn| {
        set(conn, project_id, "package_json:dev", flags(true, true))?;
        set(conn, project_id, "package_json:dev", flags(false, false))
    })
    .expect("the flags are written");

    let read = db
        .with(|conn| for_project(conn, project_id))
        .expect("the flags are readable");

    assert!(read.is_empty());
}

#[test]
fn forgetting_a_project_takes_its_flags_with_it() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn))).unwrap();

    db.with(|conn| {
        set(conn, project_id, "package_json:dev", flags(true, false))?;
        crate::persistence::repositories::projects::delete(conn, project_id)
    })
    .expect("the project is removed");

    let read = db
        .with(|conn| for_project(conn, project_id))
        .expect("the flags are readable");

    assert!(read.is_empty());
}

#[test]
fn flags_are_per_project() {
    let db = database();
    let first = db.with(|conn| Ok(seed(conn))).unwrap();
    let second = db
        .with(|conn| {
            conn.execute(
                "INSERT INTO projects (path, name, added_at) VALUES ('/tmp/two', 'two', 2)",
                [],
            )
            .map_err(crate::persistence::storage_error)?;

            Ok(conn.last_insert_rowid())
        })
        .unwrap();

    db.with(|conn| set(conn, first, "package_json:dev", flags(true, false)))
        .expect("the flag is written");

    let other = db
        .with(|conn| for_project(conn, second))
        .expect("the flags are readable");

    assert!(other.is_empty());
}
