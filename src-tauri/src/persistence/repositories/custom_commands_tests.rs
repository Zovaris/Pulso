use super::custom_commands::*;
use crate::domain::{
    command::{CommandScan, ScanStatus},
    execution::{Execution, ExecutionState},
    log::{LogLine, LogStream},
};
use crate::persistence::repositories::executions;
use crate::process::supervisor::ProcessSupervisor;
use crate::support::paths;
use rusqlite::Connection;
use std::sync::Arc;

fn database() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
    for sql in [
        include_str!("../../../migrations/0001_projects.sql"),
        include_str!("../../../migrations/0002_command_flags.sql"),
        include_str!("../../../migrations/0003_execution_history.sql"),
        include_str!("../../../migrations/0004_custom_commands.sql"),
    ] {
        conn.execute_batch(sql).unwrap();
    }
    conn
}

fn command(project_id: Option<i64>) -> CustomCommand {
    CustomCommand {
        id: None,
        project_id,
        label: "Quoted output".into(),
        command: "printf '%s\\n' 'hello world' | tr a-z A-Z".into(),
        cwd: std::env::temp_dir().to_string_lossy().into(),
        favorite: true,
    }
}

#[test]
fn personal_and_project_commands_persist_and_survive_scans() {
    let conn = database();
    conn.execute(
        "INSERT INTO projects (id, path, name, added_at) VALUES (1, '/tmp', 'Test', 1)",
        [],
    )
    .unwrap();
    save(&conn, &command(None)).unwrap();
    save(&conn, &command(Some(1))).unwrap();
    let mut saved = list(&conn).unwrap();
    assert_eq!(saved.len(), 2);
    assert_eq!(saved[0].project_id, None);
    let scan = augment_scan(&conn, CommandScan::new(1, ScanStatus::NoManifest, None)).unwrap();
    assert_eq!(scan.commands.len(), 1);
    assert_eq!(scan.status, ScanStatus::Detected);
    assert!(scan.flags[&scan.commands[0].id].favorite);
    assert_eq!(
        augment_scan(&conn, CommandScan::new(1, ScanStatus::NoManifest, None))
            .unwrap()
            .commands,
        scan.commands
    );
    saved[0].label = "Updated".into();
    save(&conn, &saved[0]).unwrap();
    assert_eq!(by_id(&conn, saved[0].id.unwrap()).unwrap().label, "Updated");
    conn.execute("DELETE FROM projects WHERE id=1", []).unwrap();
    assert_eq!(
        list(&conn).unwrap().len(),
        1,
        "personal commands outlive project deletion"
    );
    delete(&conn, saved[0].id.unwrap()).unwrap();
    assert!(list(&conn).unwrap().is_empty());
    assert!(
        save(&conn, &saved[0]).is_err(),
        "stale edits cannot recreate deleted commands"
    );
}

#[test]
fn upgrading_preserves_existing_runs_logs_and_foreign_keys() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
    conn.execute_batch(include_str!("../../../migrations/0001_projects.sql"))
        .unwrap();
    conn.execute_batch(include_str!(
        "../../../migrations/0003_execution_history.sql"
    ))
    .unwrap();
    conn.execute("INSERT INTO projects VALUES (1, '/tmp', 'Test', 1)", [])
        .unwrap();
    let mut run = Execution::new(1, 1, &command(Some(1)).detected(), 1);
    run.state = ExecutionState::Exited;
    run.ended_at = Some(2);
    let id = executions::record(
        &conn,
        &run,
        &[LogLine {
            seq: 1,
            at: 1,
            stream: LogStream::Stdout,
            text: "kept".into(),
        }],
    )
    .unwrap();
    conn.execute_batch(include_str!("../../../migrations/0004_custom_commands.sql"))
        .unwrap();
    assert_eq!(executions::recent(&conn, None, 10).unwrap()[0].id, id);
    assert_eq!(executions::lines(&conn, id, 10).unwrap()[0].text, "kept");
    conn.execute("DELETE FROM projects WHERE id=1", []).unwrap();
    assert!(executions::recent(&conn, None, 10).unwrap().is_empty());
    assert!(executions::lines(&conn, id, 10).unwrap().is_empty());
}

#[tokio::test]
async fn personal_shell_commands_execute_quotes_pipes_and_keep_history_without_a_project() {
    let conn = database();
    save(&conn, &command(None)).unwrap();
    let saved = list(&conn).unwrap().remove(0);
    let supervisor = ProcessSupervisor::new(Arc::new(|_| {}), Arc::new(|_, _| {}));
    let run = supervisor
        .start(PERSONAL_SCOPE, &saved.detected(), None)
        .await
        .unwrap();
    let mut finished = None;
    for _ in 0..100 {
        if let Some(run) = supervisor.list().into_iter().find(|run| !run.is_active()) {
            finished = Some(run);
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    let finished = finished.expect("the shell command finishes");
    assert_eq!(finished.exit_code, Some(0));
    let logs = supervisor.logs(run.id, None, 20).unwrap().lines;
    assert!(logs.iter().any(|line| line.text == "HELLO WORLD"));
    executions::record(&conn, &finished, &logs).unwrap();
    assert_eq!(
        executions::recent(&conn, Some(PERSONAL_SCOPE), 10).unwrap()[0].project_id,
        PERSONAL_SCOPE
    );
    assert_eq!(
        conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn folders_default_to_home_or_project_and_explicit_tilde_always_means_home() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(include_str!("../../../migrations/0001_projects.sql"))
        .unwrap();
    let home = std::env::temp_dir();
    let project = std::env::current_dir().unwrap();
    conn.execute(
        "INSERT INTO projects (id, path, name, added_at) VALUES (1, ?1, 'Test', 1)",
        [project.to_string_lossy().as_ref()],
    )
    .unwrap();
    let mut command = CustomCommand {
        id: None,
        project_id: None,
        label: "Test".into(),
        command: "pwd".into(),
        cwd: String::new(),
        favorite: false,
    };
    assert_eq!(
        resolve_cwd(&conn, &command, &home).unwrap(),
        paths::as_string(&paths::canonical_dir(&home).unwrap())
    );
    command.project_id = Some(1);
    assert_eq!(
        resolve_cwd(&conn, &command, &home).unwrap(),
        paths::as_string(&paths::canonical_dir(&project).unwrap())
    );
    command.cwd = "~".into();
    assert_eq!(
        resolve_cwd(&conn, &command, &home).unwrap(),
        paths::as_string(&paths::canonical_dir(&home).unwrap())
    );
    command.cwd = "relative/folder".into();
    assert!(resolve_cwd(&conn, &command, &home).is_err());
    command.cwd = "/pulso/nonexistent/folder".into();
    assert!(resolve_cwd(&conn, &command, &home).is_err());
}
