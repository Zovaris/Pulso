use super::*;
use crate::persistence::database::Database;

fn database() -> Database {
    let path = std::env::temp_dir().join(format!(
        "pulso-transfer-{}-{:?}.db",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    let _ = std::fs::remove_file(&path);

    Database::open(&path).expect("the database opens")
}

fn add(conn: &Connection, path: &str, name: &str) {
    repositories::projects::ensure(conn, path, name, now_ms()).expect("the project is stored");
}

#[test]
fn an_empty_database_exports_an_empty_bundle() {
    let db = database();
    let bundle = db.with(export).expect("the export runs");

    assert_eq!(bundle.version, VERSION);
    assert!(bundle.projects.is_empty());
}

#[test]
fn the_bundle_keeps_the_order_and_the_names() {
    let db = database();
    db.with(|conn| {
        add(conn, "/tmp/one", "one");
        add(conn, "/tmp/two", "two");

        Ok(())
    })
    .unwrap();

    let bundle = db.with(export).expect("the export runs");

    assert_eq!(bundle.projects.len(), 2);
    assert_eq!(bundle.projects[0].name, "one");
    assert_eq!(bundle.projects[1].path, "/tmp/two");
}

#[test]
fn flags_travel_with_the_project_that_owns_them() {
    let db = database();
    db.with(|conn| {
        let row = repositories::projects::ensure(conn, "/tmp/one", "one", now_ms())?;
        repositories::flags::set(
            conn,
            row.id,
            "package_json:dev",
            CommandFlags {
                favorite: true,
                hidden: false,
            },
        )?;
        repositories::flags::set(
            conn,
            row.id,
            "makefile:clean",
            CommandFlags {
                favorite: false,
                hidden: true,
            },
        )
    })
    .unwrap();

    let bundle = db.with(export).expect("the export runs");

    assert_eq!(bundle.projects[0].favorite, vec!["package_json:dev"]);
    assert_eq!(bundle.projects[0].hidden, vec!["makefile:clean"]);
}

#[test]
fn exporting_and_importing_leaves_the_same_list() {
    let db = database();
    db.with(|conn| {
        add(conn, "/tmp/one", "one");
        add(conn, "/tmp/two", "two");

        Ok(())
    })
    .unwrap();

    let bundle = db.with(export).expect("the export runs");

    db.with(|conn| {
        conn.execute("DELETE FROM projects", [])
            .map_err(crate::persistence::storage_error)
    })
    .unwrap();

    let imported = db
        .with(|conn| import(conn, &bundle))
        .expect("the import runs");

    assert_eq!(imported, 2);

    let after = db.with(export).expect("the second export runs");
    assert_eq!(after.projects, bundle.projects);
}

#[test]
fn importing_the_same_file_twice_adds_nothing() {
    let db = database();
    db.with(|conn| {
        add(conn, "/tmp/one", "one");

        Ok(())
    })
    .unwrap();

    let bundle = db.with(export).expect("the export runs");
    db.with(|conn| import(conn, &bundle))
        .expect("the import runs");

    let projects = db
        .with(repositories::projects::list)
        .expect("the list reads");

    assert_eq!(projects.len(), 1);
}

#[test]
fn importing_keeps_a_flag_that_was_already_set() {
    let db = database();
    db.with(|conn| {
        let row = repositories::projects::ensure(conn, "/tmp/one", "one", now_ms())?;
        repositories::flags::set(
            conn,
            row.id,
            "package_json:dev",
            CommandFlags {
                favorite: false,
                hidden: true,
            },
        )
    })
    .unwrap();

    let bundle = db.with(export).expect("the export runs");
    db.with(|conn| import(conn, &bundle))
        .expect("the import runs");

    let flags = db
        .with(|conn| repositories::flags::for_project(conn, 1))
        .expect("the flags read");

    assert!(flags["package_json:dev"].hidden);
}

#[test]
fn a_bundle_from_the_future_is_refused() {
    let db = database();
    let bundle = Bundle {
        version: VERSION + 1,
        projects: Vec::new(),
    };

    let error = db.with(|conn| import(conn, &bundle)).unwrap_err();

    assert_eq!(error.kind, ErrorKind::InvalidInput);
}

#[test]
fn a_project_with_an_empty_path_is_skipped() {
    let db = database();
    let bundle = Bundle {
        version: VERSION,
        projects: vec![
            BundleProject {
                name: "nothing".to_string(),
                path: "   ".to_string(),
                favorite: Vec::new(),
                hidden: Vec::new(),
            },
            BundleProject {
                name: "one".to_string(),
                path: "/tmp/one".to_string(),
                favorite: Vec::new(),
                hidden: Vec::new(),
            },
        ],
    };

    let imported = db
        .with(|conn| import(conn, &bundle))
        .expect("the import runs");

    assert_eq!(imported, 1);
}

#[test]
fn a_file_without_flags_still_parses() {
    let bundle: Bundle =
        serde_json::from_str(r#"{"version":1,"projects":[{"name":"one","path":"/tmp/one"}]}"#)
            .expect("the bundle should parse");

    assert!(bundle.projects[0].favorite.is_empty());
    assert!(bundle.projects[0].hidden.is_empty());
}
