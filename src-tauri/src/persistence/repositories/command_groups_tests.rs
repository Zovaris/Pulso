use super::command_groups::*;
use rusqlite::Connection;

fn database() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
    for sql in [
        include_str!("../../../migrations/0001_projects.sql"),
        include_str!("../../../migrations/0002_command_flags.sql"),
        include_str!("../../../migrations/0003_execution_history.sql"),
        include_str!("../../../migrations/0004_custom_commands.sql"),
        include_str!("../../../migrations/0005_command_groups.sql"),
    ] {
        conn.execute_batch(sql).unwrap();
    }
    conn.execute(
        "INSERT INTO projects (id, path, name, added_at) VALUES (1, '/tmp/api', 'api', 1), (2, '/tmp/web', 'web', 1)",
        [],
    )
    .unwrap();
    conn
}

fn member(project_id: i64, command_id: &str) -> GroupMember {
    GroupMember {
        project_id,
        command_id: command_id.into(),
    }
}

fn group(members: Vec<GroupMember>) -> CommandGroup {
    CommandGroup {
        id: None,
        label: "  Stack  ".into(),
        members,
    }
}

#[test]
fn a_group_keeps_its_commands_in_the_order_they_were_chosen() {
    let conn = database();
    let saved = normalized(group(vec![
        member(2, "package_json:dev"),
        member(1, "package_json:dev"),
        member(0, "custom:9"),
    ]))
    .unwrap();
    save(&conn, &saved).unwrap();

    let listed = list(&conn).unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].label, "Stack");
    assert_eq!(listed[0].members, saved.members);
}

#[test]
fn editing_replaces_the_members_and_deleting_removes_them() {
    let conn = database();
    save(
        &conn,
        &normalized(group(vec![member(1, "a"), member(2, "b")])).unwrap(),
    )
    .unwrap();
    let mut edited = list(&conn).unwrap().remove(0);
    edited.members = vec![member(2, "b")];
    save(&conn, &edited).unwrap();
    assert_eq!(list(&conn).unwrap()[0].members, vec![member(2, "b")]);

    delete(&conn, edited.id.unwrap()).unwrap();
    assert!(list(&conn).unwrap().is_empty());
    let left: i64 = conn
        .query_row("SELECT COUNT(*) FROM command_group_members", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(left, 0);
}

#[test]
fn a_removed_project_or_custom_command_leaves_its_groups() {
    let conn = database();
    conn.execute(
        "INSERT INTO custom_commands (id, project_id, label, command, cwd) VALUES (9, NULL, 'brew', 'brew update', '/tmp')",
        [],
    )
    .unwrap();
    save(
        &conn,
        &normalized(group(vec![
            member(1, "dev"),
            member(2, "dev"),
            member(0, "custom:9"),
        ]))
        .unwrap(),
    )
    .unwrap();

    conn.execute("DELETE FROM projects WHERE id = 1", [])
        .unwrap();
    conn.execute("DELETE FROM custom_commands WHERE id = 9", [])
        .unwrap();

    assert_eq!(list(&conn).unwrap()[0].members, vec![member(2, "dev")]);
}

#[test]
fn a_group_needs_a_name_and_real_commands_once_each() {
    assert!(normalized(CommandGroup {
        id: None,
        label: " ".into(),
        members: vec![member(1, "a")]
    })
    .is_err());
    assert!(normalized(group(vec![])).is_err());
    assert!(normalized(group(vec![member(1, " ")])).is_err());
    assert!(normalized(group(
        (0..25).map(|i| member(1, &format!("c{i}"))).collect()
    ))
    .is_err());
    assert_eq!(
        normalized(group(vec![member(1, "a"), member(1, "a"), member(2, "a")]))
            .unwrap()
            .members,
        vec![member(1, "a"), member(2, "a")]
    );
}

#[test]
fn saving_a_group_that_was_deleted_says_so() {
    let conn = database();
    let missing = CommandGroup {
        id: Some(42),
        label: "Gone".into(),
        members: vec![member(1, "a")],
    };
    assert!(save(&conn, &missing).is_err());
    assert!(delete(&conn, 42).is_err());
}
