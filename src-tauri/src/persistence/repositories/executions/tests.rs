use std::sync::atomic::{AtomicUsize, Ordering};

use super::*;
use crate::domain::command::{CommandCategory, DetectedCommand};
use crate::domain::execution::Execution;
use crate::persistence::database::Database;

static COUNTER: AtomicUsize = AtomicUsize::new(0);

fn database() -> Database {
    let path = std::env::temp_dir().join(format!(
        "pulso-history-{}-{:?}-{}.db",
        crate::support::now_ms(),
        std::thread::current().id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    ));
    let _ = std::fs::remove_file(&path);

    Database::open(&path).expect("the database opens")
}

fn seed(conn: &Connection, name: &str) -> i64 {
    conn.execute(
        "INSERT INTO projects (path, name, added_at) VALUES (?1, ?2, 1)",
        params![format!("/tmp/{name}"), name],
    )
    .expect("the project is inserted");

    conn.last_insert_rowid()
}

fn command(label: &str) -> DetectedCommand {
    DetectedCommand {
        id: format!("package_json:{label}"),
        label: label.to_string(),
        program: "bun".to_string(),
        args: vec!["run".to_string(), label.to_string()],
        cwd: "/tmp/one".to_string(),
        source: "package.json".to_string(),
        detector: "package_json".to_string(),
        category: CommandCategory::Dev,
        long_running: true,
    }
}

fn finished(project_id: i64, label: &str, started_at: i64, exit_code: i32) -> Execution {
    let mut execution = Execution::new(1, project_id, &command(label), started_at);
    execution.state = if exit_code == 0 {
        ExecutionState::Exited
    } else {
        ExecutionState::Failed
    };
    execution.ended_at = Some(started_at + 2_400);
    execution.exit_code = Some(exit_code);

    execution
}

fn tail(count: usize) -> Vec<LogLine> {
    (1..=count)
        .map(|seq| LogLine {
            seq: seq as u64,
            at: 1_700_000_000_000 + seq as i64,
            stream: if seq % 3 == 0 {
                LogStream::Stderr
            } else {
                LogStream::Stdout
            },
            text: format!("line {seq}"),
        })
        .collect()
}

#[test]
fn a_finished_run_keeps_what_it_was_and_how_it_ended() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();

    let id = db
        .with(|conn| {
            record(
                conn,
                &finished(project_id, "dev", 1_700_000_000_000, 2),
                &tail(5),
            )
        })
        .expect("the run is written");

    let runs = db
        .with(|conn| recent(conn, None, 10))
        .expect("the timeline is readable");

    assert_eq!(runs.len(), 1);
    let run = &runs[0];

    assert_eq!(run.id, id);
    assert_eq!(run.command_id, "package_json:dev");
    assert_eq!(run.label, "dev");
    assert_eq!(run.program, "bun");
    assert_eq!(run.args, vec!["run".to_string(), "dev".to_string()]);
    assert_eq!(run.state, ExecutionState::Failed);
    assert_eq!(run.exit_code, Some(2));
    assert_eq!(run.ended_at, Some(1_700_000_000_000 + 2_400));
    assert_eq!(run.lines, 5);
}

#[test]
fn the_stored_tail_is_capped_and_keeps_the_end() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();

    let id = db
        .with(|conn| {
            record(
                conn,
                &finished(project_id, "dev", 1, 0),
                &tail(KEPT_LINES + 20),
            )
        })
        .expect("the run is written");

    let kept = db
        .with(|conn| lines(conn, id, KEPT_LINES * 4))
        .expect("the tail is readable");

    assert_eq!(kept.len(), KEPT_LINES);
    assert_eq!(kept[0].text, "line 21");
    assert_eq!(
        kept[KEPT_LINES - 1].text,
        format!("line {}", KEPT_LINES + 20)
    );
    assert_eq!(kept[0].stream, LogStream::Stderr);
    assert_eq!(kept[1].stream, LogStream::Stdout);

    let run = db.with(|conn| recent(conn, None, 1)).unwrap();
    assert_eq!(run[0].lines, KEPT_LINES);
}

#[test]
fn the_timeline_is_newest_first_and_answers_for_one_project() {
    let db = database();
    let (first, second) = db
        .with(|conn| Ok((seed(conn, "one"), seed(conn, "two"))))
        .unwrap();

    db.with(|conn| {
        record(conn, &finished(first, "dev", 100, 0), &[])?;
        record(conn, &finished(second, "test", 200, 1), &[])?;
        record(conn, &finished(first, "build", 300, 0), &[])
    })
    .expect("the runs are written");

    let all = db.with(|conn| recent(conn, None, 10)).unwrap();
    assert_eq!(
        all.iter().map(|run| run.label.as_str()).collect::<Vec<_>>(),
        vec!["build", "test", "dev"]
    );

    let mine = db.with(|conn| recent(conn, Some(first), 10)).unwrap();
    assert_eq!(
        mine.iter()
            .map(|run| run.label.as_str())
            .collect::<Vec<_>>(),
        vec!["build", "dev"]
    );
}

#[test]
fn forgetting_a_project_takes_its_runs_and_their_output() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();

    let id = db
        .with(|conn| record(conn, &finished(project_id, "dev", 1, 0), &tail(3)))
        .expect("the run is written");

    db.with(|conn| crate::persistence::repositories::projects::delete(conn, project_id))
        .expect("the project is removed");

    assert_eq!(db.with(count).unwrap(), 0);
    assert!(db.with(|conn| lines(conn, id, 10)).unwrap().is_empty());
}

#[test]
fn clearing_leaves_nothing_behind() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();

    db.with(|conn| record(conn, &finished(project_id, "dev", 1, 0), &tail(4)))
        .expect("the run is written");

    let removed = db.with(clear).expect("the history is cleared");

    assert_eq!(removed, 1);
    assert_eq!(db.with(count).unwrap(), 0);
    assert!(db.with(|conn| recent(conn, None, 10)).unwrap().is_empty());
}

#[test]
fn the_file_keeps_only_the_last_runs() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();
    let overflow = 5;

    db.with(|conn| {
        for index in 0..(KEPT_RUNS + overflow) {
            record(
                conn,
                &finished(project_id, "dev", index as i64, 0),
                &tail(1),
            )?;
        }

        Ok(())
    })
    .expect("the runs are written");

    let kept = db
        .with(|conn| recent(conn, None, KEPT_RUNS + overflow))
        .unwrap();

    assert_eq!(kept.len(), KEPT_RUNS);
    assert_eq!(kept[0].started_at, (KEPT_RUNS + overflow - 1) as i64);
    assert_eq!(kept[KEPT_RUNS - 1].started_at, overflow as i64);
}

#[test]
fn a_run_a_previous_session_was_watching_is_closed_as_interrupted() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();

    db.with(|conn| {
        let mut running = Execution::new(1, project_id, &command("dev"), 1_000);
        running.state = ExecutionState::Running;
        record(conn, &running, &tail(2))
    })
    .expect("the run is written");

    let closed = db
        .with(|conn| close_orphans(conn, 9_000))
        .expect("the orphans are closed");

    assert_eq!(closed, 1);

    let runs = db.with(|conn| recent(conn, None, 10)).unwrap();
    assert_eq!(runs[0].state, ExecutionState::Interrupted);
    assert_eq!(runs[0].ended_at, Some(9_000));
    assert_eq!(runs[0].exit_code, None);
}

#[test]
fn a_state_this_build_does_not_know_reads_as_interrupted() {
    let db = database();
    let project_id = db.with(|conn| Ok(seed(conn, "one"))).unwrap();

    db.with(|conn| {
        conn.execute(
            "INSERT INTO executions
                (project_id, command_id, label, program, args, cwd, state, started_at)
             VALUES (?1, 'x', 'x', 'x', '[]', '/tmp', 'teleported', 1)",
            params![project_id],
        )
        .map_err(crate::persistence::storage_error)?;

        Ok(())
    })
    .unwrap();

    let runs = db.with(|conn| recent(conn, None, 10)).unwrap();
    assert_eq!(runs[0].state, ExecutionState::Interrupted);
}
