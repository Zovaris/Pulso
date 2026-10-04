use super::*;
use crate::domain::command::{CommandCategory, DetectedCommand};
use crate::domain::port::DetectedPort;

fn execution(id: i64, state: ExecutionState) -> Execution {
    let command = DetectedCommand {
        id: "package.json:dev".to_string(),
        label: "dev".to_string(),
        program: "bun".to_string(),
        args: vec!["run".to_string(), "dev".to_string()],
        cwd: "/tmp/project".to_string(),
        source: "package.json".to_string(),
        detector: "package_json".to_string(),
        category: CommandCategory::Dev,
        long_running: true,
    };
    let mut execution = Execution::new(id, 1, &command, 1_000);
    execution.state = state;
    execution
}

fn listening(id: i64, port: u16) -> Execution {
    let mut execution = execution(id, ExecutionState::Running);
    execution.ports.push(DetectedPort {
        id: format!("{port}"),
        port,
        url: Some(format!("http://localhost:{port}")),
    });
    execution
}

fn failed(label: &str, project: &str) -> Notice {
    Notice::Failed {
        project: project.to_string(),
        label: label.to_string(),
        code: Some(1),
    }
}

fn ready(label: &str, project: &str, port: u16) -> Notice {
    Notice::Ready {
        project: project.to_string(),
        label: label.to_string(),
        port,
    }
}

#[test]
fn a_server_is_announced_once_when_it_opens_its_first_port() {
    let mut tracker = Tracker::default();

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Running)),
        None
    );
    assert_eq!(tracker.observe(&listening(1, 5173)), Some(Kind::Ready));
    assert_eq!(tracker.observe(&listening(1, 5173)), None);
}

#[test]
fn a_long_clean_ending_is_done_and_a_short_one_is_not() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Running));
    tracker.observe(&execution(2, ExecutionState::Running));

    let mut long = execution(1, ExecutionState::Exited);
    long.ended_at = Some(long.started_at + LONG_RUN_MS + 1);
    let mut short = execution(2, ExecutionState::Exited);
    short.ended_at = Some(short.started_at + 900);

    assert_eq!(tracker.observe(&long), Some(Kind::Done));
    assert_eq!(tracker.observe(&short), None);
}

#[test]
fn stopping_on_purpose_is_never_announced() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Stopping));
    let mut stopped = execution(1, ExecutionState::Exited);
    stopped.ended_at = Some(stopped.started_at + LONG_RUN_MS * 10);

    assert_eq!(tracker.observe(&stopped), None);
}

#[test]
fn a_failure_is_announced_once() {
    let mut tracker = Tracker::default();

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Failed)),
        Some(Kind::Failed)
    );
    assert_eq!(tracker.observe(&execution(1, ExecutionState::Failed)), None);
}

#[test]
fn one_notice_reads_as_a_sentence() {
    assert_eq!(
        compose(Locale::En, vec![failed("test", "Apex")]),
        ("test failed".to_string(), "Apex · exit code 1".to_string())
    );
    assert_eq!(
        compose(Locale::Es, vec![ready("dev", "Apex", 5173)]),
        ("dev listo en :5173".to_string(), "Apex".to_string())
    );
}

#[test]
fn a_burst_of_one_kind_is_counted_in_the_title() {
    let (title, body) = compose(
        Locale::En,
        vec![ready("api", "Shop", 3000), ready("web", "Shop", 5173)],
    );

    assert_eq!(title, "2 servers ready");
    assert_eq!(body, "api ready on :3000 · Shop\nweb ready on :5173 · Shop");
}

#[test]
fn failures_lead_a_mixed_burst_and_the_rest_is_counted() {
    let (title, body) = compose(
        Locale::Es,
        vec![
            ready("api", "Shop", 3000),
            ready("web", "Shop", 5173),
            ready("docs", "Shop", 4000),
            failed("db", "Shop"),
        ],
    );

    assert_eq!(title, "Pulso · 4 avisos");
    assert_eq!(body.lines().next(), Some("db falló · Shop"));
    assert_eq!(body.lines().last(), Some("y 1 más"));
}

#[test]
fn a_duration_reads_like_a_stopwatch() {
    assert_eq!(duration(45_400), "45 s");
    assert_eq!(duration(134_000), "2:14");
    assert_eq!(duration(3_729_000), "1:02:09");
}
