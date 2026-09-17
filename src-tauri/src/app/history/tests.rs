use super::*;
use crate::domain::command::{CommandCategory, DetectedCommand};
use crate::domain::execution::ExecutionState;
use crate::domain::log::LogStream;
use crate::persistence::repositories;
use rusqlite::Connection;

fn database() -> Arc<Database> {
    let path = std::env::temp_dir().join(format!(
        "pulso-recorder-{}-{:?}.db",
        now_ms(),
        std::thread::current().id()
    ));
    let _ = std::fs::remove_file(&path);

    Arc::new(Database::open(&path).expect("the database opens"))
}

fn seed(db: &Arc<Database>) -> i64 {
    db.with(|conn: &Connection| {
        conn.execute(
            "INSERT INTO projects (path, name, added_at) VALUES ('/tmp/one', 'one', 1)",
            [],
        )
        .map_err(crate::persistence::storage_error)?;

        Ok(conn.last_insert_rowid())
    })
    .expect("the project is inserted")
}

fn command() -> DetectedCommand {
    DetectedCommand {
        id: "package_json:dev".to_string(),
        label: "dev".to_string(),
        program: "bun".to_string(),
        args: vec!["run".to_string(), "dev".to_string()],
        cwd: "/tmp/one".to_string(),
        source: "package.json".to_string(),
        detector: "package_json".to_string(),
        category: CommandCategory::Dev,
        long_running: true,
    }
}

fn execution(project_id: i64, state: ExecutionState) -> Execution {
    let mut execution = Execution::new(7, project_id, &command(), 1_700_000_000_000);
    execution.state = state;
    if !state.is_active() {
        execution.ended_at = Some(1_700_000_001_000);
    }

    execution
}

fn tail() -> Vec<LogLine> {
    vec![LogLine {
        seq: 1,
        at: 1_700_000_000_500,
        stream: LogStream::Stderr,
        text: "boom".to_string(),
    }]
}

#[test]
fn a_run_that_ended_is_written_once() {
    let db = database();
    let project_id = seed(&db);
    let history = ExecutionHistory::new(Arc::clone(&db));
    let run = execution(project_id, ExecutionState::Failed);

    history.observe(&run, &tail());
    history.observe(&run, &tail());

    let runs = db
        .with(|conn| repositories::executions::recent(conn, None, 10))
        .unwrap();

    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].state, ExecutionState::Failed);
    assert_eq!(runs[0].lines, 1);
}

#[test]
fn a_run_that_is_still_going_is_not_written() {
    let db = database();
    let project_id = seed(&db);
    let history = ExecutionHistory::new(Arc::clone(&db));

    history.observe(&execution(project_id, ExecutionState::Running), &[]);

    assert_eq!(db.with(repositories::executions::count).unwrap(), 0);
}

#[test]
fn orphans_are_closed_before_the_timeline_is_read() {
    let db = database();
    let project_id = seed(&db);
    let history = ExecutionHistory::new(Arc::clone(&db));

    history
        .record(&execution(project_id, ExecutionState::Running), &[])
        .expect("the run is written");

    assert_eq!(history.close_orphans(), 1);

    let runs = db
        .with(|conn| repositories::executions::recent(conn, None, 10))
        .unwrap();
    assert_eq!(runs[0].state, ExecutionState::Interrupted);
}

#[test]
fn a_run_is_written_with_what_it_printed() {
    let db = database();
    let project_id = seed(&db);
    let history = ExecutionHistory::new(Arc::clone(&db));

    let id = history
        .record(&execution(project_id, ExecutionState::Exited), &tail())
        .expect("the run is written");

    let kept = db
        .with(|conn| repositories::executions::lines(conn, id, 10))
        .unwrap();

    assert_eq!(kept.len(), 1);
    assert_eq!(kept[0].text, "boom");
    assert_eq!(kept[0].stream, LogStream::Stderr);
}
