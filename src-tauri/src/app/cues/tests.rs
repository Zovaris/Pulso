use super::*;
use crate::domain::command::{CommandCategory, DetectedCommand};

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

#[test]
fn a_fresh_execution_starts_with_a_cue() {
    let mut tracker = Tracker::default();

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Starting)),
        Some(Cue::Start)
    );
}

#[test]
fn nothing_is_said_while_a_command_is_still_working() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Starting));

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Running)),
        None
    );
    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Stopping)),
        None
    );
}

#[test]
fn a_clean_exit_is_a_success() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Running));

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Exited)),
        Some(Cue::Success)
    );
}

#[test]
fn an_exit_the_user_asked_for_stays_silent() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Running));
    tracker.observe(&execution(1, ExecutionState::Stopping));

    assert_eq!(tracker.observe(&execution(1, ExecutionState::Exited)), None);
}

#[test]
fn any_other_ending_is_a_failure() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Starting));

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Failed)),
        Some(Cue::Failure)
    );
}

#[test]
fn a_state_seen_twice_only_sounds_once() {
    let mut tracker = Tracker::default();

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Starting)),
        Some(Cue::Start)
    );
    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Starting)),
        None
    );
    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Failed)),
        Some(Cue::Failure)
    );
    assert_eq!(tracker.observe(&execution(1, ExecutionState::Failed)), None);
}

#[test]
fn two_executions_do_not_talk_over_each_other() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Starting));

    assert_eq!(
        tracker.observe(&execution(2, ExecutionState::Starting)),
        Some(Cue::Start)
    );
    assert_eq!(
        tracker.observe(&execution(2, ExecutionState::Failed)),
        Some(Cue::Failure)
    );
    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Running)),
        None
    );
}

#[test]
fn an_execution_met_halfway_is_not_greeted() {
    let mut tracker = Tracker::default();

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Running)),
        None
    );
    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Exited)),
        Some(Cue::Success)
    );
}
