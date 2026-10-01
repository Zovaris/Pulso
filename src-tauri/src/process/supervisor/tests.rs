use super::*;
use crate::domain::command::CommandCategory;

fn command(label: &str, program: &str, args: &[&str]) -> DetectedCommand {
    DetectedCommand {
        id: format!("test:{label}"),
        label: label.to_string(),
        program: program.to_string(),
        args: args.iter().map(|arg| arg.to_string()).collect(),
        cwd: std::env::temp_dir().to_string_lossy().into_owned(),
        source: "test".to_string(),
        detector: "test".to_string(),
        category: CommandCategory::Other,
        long_running: false,
    }
}

fn supervisor() -> ProcessSupervisor {
    ProcessSupervisor::new(Arc::new(|_| {}), Arc::new(|_, _| {}))
}

#[tokio::test]
async fn a_started_command_runs_and_stops_without_leaving_its_group() {
    let supervisor = supervisor();
    let started = supervisor
        .start(1, &command("sleep", "/bin/sleep", &["30"]), None)
        .await
        .expect("the command should start");

    assert_eq!(started.state, ExecutionState::Running);
    let pgid = started.pid.expect("a running execution has a pid") as i32;
    assert!(signals::group_exists(pgid));

    let stopped = supervisor
        .stop(started.id)
        .await
        .expect("the command stops");
    assert_eq!(stopped.state, ExecutionState::Exited);
    assert!(!signals::group_exists(pgid), "the group outlived the stop");
}

#[tokio::test]
async fn a_process_that_leaves_children_behind_is_stopped_as_a_group() {
    let supervisor = supervisor();
    let started = supervisor
        .start(
            1,
            &command("tree", "/bin/sh", &["-c", "sleep 30 & sleep 30"]),
            None,
        )
        .await
        .expect("the command should start");

    let pgid = started.pid.expect("a running execution has a pid") as i32;
    let stopped = supervisor
        .stop(started.id)
        .await
        .expect("the command stops");

    assert_eq!(stopped.state, ExecutionState::Exited);
    assert!(
        !signals::group_exists(pgid),
        "a child of the command survived the stop"
    );
}

#[tokio::test]
async fn a_command_that_cannot_be_found_fails_with_its_path() {
    let supervisor = supervisor();
    let failed = supervisor
        .start(1, &command("ghost", "/pulso/nowhere/ghost", &[]), None)
        .await
        .expect("a failure is reported, not thrown");

    assert_eq!(failed.state, ExecutionState::Failed);
    assert!(!failed.is_active());

    let detail = failed.detail.unwrap_or_default();
    assert!(detail.contains("/pulso/nowhere/ghost"), "{detail}");
    assert!(detail.contains("PATH"), "{detail}");
}

#[tokio::test]
async fn the_same_command_cannot_run_twice_at_once() {
    let supervisor = supervisor();
    let command = command("sleep", "/bin/sleep", &["30"]);

    let started = supervisor.start(1, &command, None).await.expect("start");
    let rejected = supervisor.start(1, &command, None).await;

    assert!(rejected.is_err());
    supervisor.stop(started.id).await.expect("stop");
}

#[tokio::test]
async fn stopping_everything_leaves_no_group_alive() {
    let supervisor = supervisor();
    let first = supervisor
        .start(1, &command("one", "/bin/sleep", &["30"]), None)
        .await
        .expect("start");
    let second = supervisor
        .start(2, &command("two", "/bin/sleep", &["30"]), None)
        .await
        .expect("start");

    supervisor.stop_all().await;

    let listed = supervisor.list();
    for execution in [first, second] {
        let pgid = execution.pid.expect("a running execution has a pid") as i32;
        assert!(!signals::group_exists(pgid), "the group outlived stop_all");

        let snapshot = listed
            .iter()
            .find(|listed| listed.id == execution.id)
            .expect("still listed");
        assert!(!snapshot.is_active());
    }
}

#[tokio::test]
async fn the_output_of_a_command_reaches_its_buffer() {
    let supervisor = supervisor();
    let started = supervisor
        .start(
            1,
            &command(
                "talk",
                "/bin/sh",
                &[
                    "-c",
                    "echo 'Local http://localhost:4321/en/'; echo down 1>&2",
                ],
            ),
            None,
        )
        .await
        .expect("start");

    let finished = supervisor
        .await_final_state(started.id)
        .await
        .expect("the command finishes on its own");
    assert_eq!(finished.state, ExecutionState::Exited);

    let mut lines = Vec::new();
    let mut ports = Vec::new();
    for _ in 0..60 {
        lines = supervisor
            .logs(started.id, None, 50)
            .expect("the buffer is readable")
            .lines;
        ports = supervisor
            .snapshot(started.id)
            .expect("the execution is still listed")
            .ports;

        if lines.len() >= 2 && !ports.is_empty() {
            break;
        }
        sleep(FLUSH).await;
    }

    assert_eq!(lines.len(), 2, "both streams are captured");
    assert!(lines.iter().any(|line| line.stream == LogStream::Stdout));
    assert!(lines.iter().any(|line| line.stream == LogStream::Stderr));

    assert_eq!(ports.len(), 1);
    assert_eq!(ports[0].port, 4321);
    assert_eq!(
        supervisor
            .url(started.id, &ports[0].id)
            .expect("the URL is openable"),
        "http://localhost:4321/en/"
    );
}

#[tokio::test]
async fn concurrent_starts_reserve_the_command_once() {
    let supervisor = supervisor();
    let command = command("concurrent", "/bin/sleep", &["30"]);
    let (first, second) = tokio::join!(
        supervisor.start(1, &command, None),
        supervisor.start(1, &command, None),
    );
    assert_ne!(first.is_ok(), second.is_ok());
    let started = first.or(second).expect("one start succeeds");
    supervisor.stop(started.id).await.expect("stop");
}

#[tokio::test]
async fn children_remain_stoppable_after_the_parent_exits() {
    let supervisor = supervisor();
    let started = supervisor
        .start(
            1,
            &command("orphan", "/bin/sh", &["-c", "sleep 30 & exit 0"]),
            None,
        )
        .await
        .expect("start");
    sleep(Duration::from_millis(150)).await;
    assert!(supervisor.snapshot(started.id).unwrap().is_active());
    let stopped = supervisor.stop(started.id).await.expect("stop descendants");
    assert!(!stopped.is_active());
    assert!(!signals::group_exists(started.pid.unwrap() as i32));
}

#[tokio::test]
async fn final_output_is_drained_before_history_is_written() {
    let supervisor = supervisor();
    let written = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&written);
    supervisor.on_finished(Arc::new(move |_, lines| {
        *observed.lock().unwrap() = lines.to_vec();
    }));
    let started = supervisor
        .start(
            1,
            &command("tail", "/bin/sh", &["-c", "echo first; printf last >&2"]),
            None,
        )
        .await
        .unwrap();
    supervisor
        .await_final_state(started.id)
        .await
        .expect("finished");
    let lines = written.lock().unwrap();
    assert!(lines.iter().any(|line| line.text == "first"));
    assert!(lines.iter().any(|line| line.text == "last"));
}

#[tokio::test]
async fn the_reader_bounds_partial_lines_and_survives_invalid_utf8() {
    use tokio::io::AsyncWriteExt;
    let logs = Arc::new(LogBuffer::new(Arc::new(AtomicUsize::new(4000))));
    let (mut writer, reader) = tokio::io::duplex(8192);
    let readers = Arc::new(AtomicUsize::new(1));
    let task = read_stream(
        reader,
        LogStream::Stdout,
        Arc::clone(&logs),
        Arc::new(Mutex::new(HashMap::new())),
        Arc::new(|_| {}),
        Arc::clone(&readers),
        1,
    );
    writer.write_all(&vec![b'x'; 1_000_000]).await.unwrap();
    assert!(logs.tail(10).is_empty());
    writer.write_all(b"\n\xff invalid\nnext\n").await.unwrap();
    drop(writer);
    task.await.unwrap();
    let lines = logs.tail(10);
    assert_eq!(lines.len(), 3);
    assert!(lines[0].text.len() <= MAX_LINE_BYTES);
    assert!(lines[0].text.ends_with("[truncated]"));
    assert!(lines[1].text.contains("invalid"));
    assert_eq!(lines[2].text, "next");
    assert_eq!(readers.load(Ordering::SeqCst), 0);
}

#[test]
fn cancelled_start_reservations_are_removed() {
    let supervisor = supervisor();
    supervisor
        .reserve(Managed {
            execution: Execution::new(1, 1, &command("cancel", "/bin/true", &[]), 1),
            pgid: 0,
            logs: Arc::new(LogBuffer::new(Arc::new(AtomicUsize::new(4000)))),
        })
        .unwrap();
    let removed = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&removed);
    let reservation = StartReservation {
        id: 1,
        executions: Arc::clone(&supervisor.executions),
        removed: Some(Arc::new(move |ids| {
            observed.lock().unwrap().extend_from_slice(ids)
        })),
    };
    drop(reservation);
    assert!(supervisor.list().is_empty());
    assert_eq!(*removed.lock().unwrap(), vec![1]);
}

#[test]
fn clearing_finished_broadcasts_removed_ids() {
    let supervisor = supervisor();
    let removed = Arc::new(Mutex::new(Vec::new()));
    let observed = Arc::clone(&removed);
    supervisor.on_removed(Arc::new(move |ids| {
        observed.lock().unwrap().extend_from_slice(ids)
    }));
    let mut execution = Execution::new(8, 1, &command("done", "/bin/true", &[]), 1);
    execution.state = ExecutionState::Exited;
    supervisor.remember(Managed {
        execution,
        pgid: 0,
        logs: Arc::new(LogBuffer::new(Arc::new(AtomicUsize::new(4000)))),
    });
    assert_eq!(supervisor.clear_finished(), 1);
    assert_eq!(*removed.lock().unwrap(), vec![8]);
}

#[test]
fn finished_executions_are_pruned_but_the_recent_ones_stay() {
    let mut executions: HashMap<i64, Managed> = HashMap::new();

    for id in 1..=(KEPT_FINISHED as i64 + 10) {
        let mut execution = Execution::new(id, 1, &command("sleep", "/bin/sleep", &[]), id);
        execution.state = ExecutionState::Exited;
        executions.insert(
            id,
            Managed {
                execution,
                pgid: 0,
                logs: Arc::new(LogBuffer::new(Arc::new(AtomicUsize::new(
                    log_buffer::DEFAULT_LINES,
                )))),
            },
        );
    }

    prune(&mut executions);

    assert_eq!(executions.len(), KEPT_FINISHED);
    assert!(executions.contains_key(&(KEPT_FINISHED as i64 + 10)));
    assert!(!executions.contains_key(&1));
}

#[tokio::test]
async fn the_process_is_launched_before_anything_is_notified() {
    let notified = Arc::new(Mutex::new(Vec::new()));
    let recorded = Arc::clone(&notified);
    let supervisor = ProcessSupervisor::new(
        Arc::new(move |execution: &Execution| {
            recorded.lock().unwrap().push(execution.state);
        }),
        Arc::new(|_, _| {}),
    );

    let started = supervisor
        .start(1, &command("quick", "/bin/sh", &["-c", "exit 0"]), None)
        .await
        .expect("the command starts");

    assert_eq!(
        notified.lock().unwrap().first().copied(),
        Some(ExecutionState::Running),
        "the UI is told about a process that is already running"
    );
    assert!(started.pid.is_some(), "the child is in its group");
}
