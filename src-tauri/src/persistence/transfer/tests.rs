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
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    assert_eq!(imported.projects, 2);

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
    let added = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");
    assert_eq!(added, Imported::default());

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
    db.with(|conn| import(conn, &bundle, &std::env::temp_dir()))
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
        personal: Vec::new(),
        groups: Vec::new(),
    };

    let error = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .unwrap_err();

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
                commands: Vec::new(),
            },
            BundleProject {
                name: "one".to_string(),
                path: "/tmp/one".to_string(),
                favorite: Vec::new(),
                hidden: Vec::new(),
                commands: Vec::new(),
            },
        ],
        personal: Vec::new(),
        groups: Vec::new(),
    };

    let imported = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    assert_eq!(imported.projects, 1);
}

#[test]
fn a_relative_path_is_skipped() {
    let db = database();
    let bundle = Bundle {
        version: VERSION,
        projects: vec![
            BundleProject {
                name: "relative".to_string(),
                path: "projects/one".to_string(),
                favorite: Vec::new(),
                hidden: Vec::new(),
                commands: Vec::new(),
            },
            BundleProject {
                name: "dotdot".to_string(),
                path: "../one".to_string(),
                favorite: Vec::new(),
                hidden: Vec::new(),
                commands: Vec::new(),
            },
        ],
        personal: Vec::new(),
        groups: Vec::new(),
    };

    let imported = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    assert_eq!(imported.projects, 0);
}

#[test]
fn an_existing_path_is_stored_canonical() {
    let root = std::env::temp_dir().join(format!(
        "pulso-import-{}-{:?}",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    let inner = root.join("inner");
    std::fs::create_dir_all(&inner).expect("the fixture exists");

    let messy = format!("{}/inner/../inner", root.to_string_lossy());
    let db = database();
    let bundle = Bundle {
        version: VERSION,
        projects: vec![BundleProject {
            name: "messy".to_string(),
            path: messy,
            favorite: Vec::new(),
            hidden: Vec::new(),
            commands: Vec::new(),
        }],
        personal: Vec::new(),
        groups: Vec::new(),
    };

    db.with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    let projects = db
        .with(repositories::projects::list)
        .expect("the list reads");

    assert_eq!(projects.len(), 1);
    let canonical = std::fs::canonicalize(&inner).expect("the fixture resolves");
    assert_eq!(projects[0].path, canonical.to_string_lossy());

    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn a_file_without_flags_still_parses() {
    let bundle: Bundle =
        serde_json::from_str(r#"{"version":1,"projects":[{"name":"one","path":"/tmp/one"}]}"#)
            .expect("the bundle should parse");

    assert!(bundle.projects[0].favorite.is_empty());
    assert!(bundle.projects[0].hidden.is_empty());
    assert!(bundle.projects[0].commands.is_empty());
    assert!(bundle.groups.is_empty());
}

fn folder(name: &str) -> String {
    let path = std::env::temp_dir().join(format!(
        "pulso-transfer-{name}-{}-{:?}",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    std::fs::create_dir_all(&path).expect("the fixture exists");
    std::fs::canonicalize(&path)
        .expect("the fixture resolves")
        .to_string_lossy()
        .into_owned()
}

fn custom(project_id: Option<i64>, label: &str, line: &str, cwd: &str) -> CustomCommand {
    CustomCommand {
        id: None,
        project_id,
        label: label.to_string(),
        command: line.to_string(),
        cwd: cwd.to_string(),
        favorite: false,
    }
}

/// A project with a custom command, a personal command, and a group that uses
/// both plus a detected command.
fn stocked(db: &Database, path: &str) {
    db.with(|conn| {
        let row = repositories::projects::ensure(conn, path, "api", now_ms())?;
        custom_commands::save(conn, &custom(Some(row.id), "deploy", "fly deploy", path))?;
        custom_commands::save(
            conn,
            &custom(
                None,
                "brew",
                "brew update",
                &std::env::temp_dir().to_string_lossy(),
            ),
        )?;
        command_groups::save(
            conn,
            &CommandGroup {
                id: None,
                label: "Stack".to_string(),
                members: vec![
                    GroupMember {
                        project_id: row.id,
                        command_id: "package_json:dev".to_string(),
                    },
                    GroupMember {
                        project_id: row.id,
                        command_id: "custom:1".to_string(),
                    },
                    GroupMember {
                        project_id: PERSONAL_SCOPE,
                        command_id: "custom:2".to_string(),
                    },
                ],
            },
        )
    })
    .unwrap();
}

fn empty(db: &Database) {
    db.with(|conn| {
        conn.execute_batch(
            "DELETE FROM command_groups; DELETE FROM custom_commands; DELETE FROM projects;",
        )
        .map_err(crate::persistence::storage_error)
    })
    .unwrap();
}

#[test]
fn custom_commands_and_groups_travel_by_path_and_name() {
    let path = folder("api");
    let db = database();
    stocked(&db, &path);

    let bundle = db.with(export).expect("the export runs");

    assert_eq!(
        bundle.projects[0].commands,
        vec![BundleCommand {
            label: "deploy".to_string(),
            command: "fly deploy".to_string(),
            cwd: String::new(),
            favorite: false,
        }]
    );
    assert_eq!(bundle.personal[0].label, "brew");
    let members = &bundle.groups[0].members;
    assert_eq!(members[0].project.as_deref(), Some(path.as_str()));
    assert_eq!(members[0].command.as_deref(), Some("package_json:dev"));
    assert_eq!(members[1].custom.as_ref().unwrap().label, "deploy");
    assert_eq!(members[2].project, None);
}

#[test]
fn groups_come_back_pointing_at_the_new_custom_commands() {
    let path = folder("api");
    let db = database();
    stocked(&db, &path);
    let bundle = db.with(export).expect("the export runs");
    empty(&db);
    db.with(|conn| custom_commands::save(conn, &custom(None, "other", "true", &path)))
        .unwrap();

    let imported = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    assert_eq!(
        imported,
        Imported {
            projects: 1,
            commands: 2,
            groups: 1,
        }
    );
    let customs = db.with(custom_commands::list).expect("the list reads");
    let deploy = customs
        .iter()
        .find(|entry| entry.label == "deploy")
        .unwrap();
    let brew = customs.iter().find(|entry| entry.label == "brew").unwrap();
    assert_eq!(deploy.cwd, path);
    let groups = db.with(command_groups::list).expect("the groups read");
    let project = deploy.project_id.unwrap();
    assert_eq!(
        groups[0].members,
        vec![
            GroupMember {
                project_id: project,
                command_id: "package_json:dev".to_string(),
            },
            GroupMember {
                project_id: project,
                command_id: format!("custom:{}", deploy.id.unwrap()),
            },
            GroupMember {
                project_id: PERSONAL_SCOPE,
                command_id: format!("custom:{}", brew.id.unwrap()),
            },
        ]
    );
}

#[test]
fn importing_commands_and_groups_twice_adds_them_once() {
    let path = folder("api");
    let db = database();
    stocked(&db, &path);
    let bundle = db.with(export).expect("the export runs");

    let again = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    assert_eq!(again, Imported::default());
    assert_eq!(db.with(custom_commands::list).unwrap().len(), 2);
    assert_eq!(db.with(command_groups::list).unwrap().len(), 1);
}

#[test]
fn a_member_whose_project_is_not_in_the_file_is_left_out() {
    let path = folder("api");
    let bundle = Bundle {
        version: VERSION,
        projects: vec![BundleProject {
            name: "api".to_string(),
            path: path.clone(),
            favorite: Vec::new(),
            hidden: Vec::new(),
            commands: Vec::new(),
        }],
        personal: Vec::new(),
        groups: vec![
            BundleGroup {
                label: "Half".to_string(),
                members: vec![
                    BundleMember {
                        project: Some(path.clone()),
                        command: Some("package_json:dev".to_string()),
                        custom: None,
                    },
                    BundleMember {
                        project: Some("/elsewhere".to_string()),
                        command: Some("package_json:dev".to_string()),
                        custom: None,
                    },
                ],
            },
            BundleGroup {
                label: "Gone".to_string(),
                members: vec![BundleMember {
                    project: None,
                    command: None,
                    custom: Some(CustomRef {
                        label: "missing".to_string(),
                        command: "true".to_string(),
                    }),
                }],
            },
        ],
    };
    let db = database();

    let imported = db
        .with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    assert_eq!(imported.groups, 1);
    let groups = db.with(command_groups::list).expect("the groups read");
    assert_eq!(groups[0].label, "Half");
    assert_eq!(groups[0].members.len(), 1);
}

#[test]
fn a_custom_command_whose_folder_is_gone_runs_at_its_project() {
    let path = folder("api");
    let bundle = Bundle {
        version: VERSION,
        projects: vec![BundleProject {
            name: "api".to_string(),
            path: path.clone(),
            favorite: Vec::new(),
            hidden: Vec::new(),
            commands: vec![BundleCommand {
                label: "deploy".to_string(),
                command: "fly deploy".to_string(),
                cwd: "/pulso/nowhere".to_string(),
                favorite: true,
            }],
        }],
        personal: Vec::new(),
        groups: Vec::new(),
    };
    let db = database();

    db.with(|conn| import(conn, &bundle, &std::env::temp_dir()))
        .expect("the import runs");

    let customs = db.with(custom_commands::list).expect("the list reads");
    assert_eq!(customs[0].cwd, path);
    assert!(customs[0].favorite);
}
