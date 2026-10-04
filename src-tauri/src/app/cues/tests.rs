use super::*;
use crate::domain::command::{CommandCategory, DetectedCommand};

fn execution(id: i64, state: ExecutionState) -> Execution {
    let command = DetectedCommand {
        id: "package.json:build".to_string(),
        label: "build".to_string(),
        program: "bun".to_string(),
        args: vec!["run".to_string(), "build".to_string()],
        cwd: "/tmp/project".to_string(),
        source: "package.json".to_string(),
        detector: "package_json".to_string(),
        category: CommandCategory::Build,
        long_running: false,
    };

    let mut execution = Execution::new(id, 1, &command, 1_000);
    execution.state = state;
    execution
}

fn ended(id: i64, state: ExecutionState, after_ms: i64) -> Execution {
    let mut execution = execution(id, state);
    execution.ended_at = Some(execution.started_at + after_ms);
    execution
}

#[test]
fn starting_a_command_makes_no_sound() {
    let mut tracker = Tracker::default();

    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Starting)),
        None
    );
    assert_eq!(
        tracker.observe(&execution(1, ExecutionState::Running)),
        None
    );
}

#[test]
fn a_long_run_that_ends_well_sounds_done() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Running));

    assert_eq!(
        tracker.observe(&ended(1, ExecutionState::Exited, LONG_RUN_MS)),
        Some(Cue::Done)
    );
}

#[test]
fn a_quick_run_ends_in_silence() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Running));

    assert_eq!(
        tracker.observe(&ended(1, ExecutionState::Exited, 1_500)),
        None
    );
}

#[test]
fn an_exit_the_user_asked_for_stays_silent() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Running));
    tracker.observe(&execution(1, ExecutionState::Stopping));

    assert_eq!(
        tracker.observe(&ended(1, ExecutionState::Exited, LONG_RUN_MS * 3)),
        None
    );
}

#[test]
fn any_failure_sounds_however_short() {
    let mut tracker = Tracker::default();
    tracker.observe(&execution(1, ExecutionState::Starting));

    assert_eq!(
        tracker.observe(&ended(1, ExecutionState::Failed, 200)),
        Some(Cue::Failure)
    );
    assert_eq!(
        tracker.observe(&ended(1, ExecutionState::Failed, 200)),
        None
    );
}

#[test]
fn a_burst_with_a_failure_in_it_sounds_like_a_failure() {
    assert_eq!(
        loudest(&[Cue::Done, Cue::Failure, Cue::Done]),
        Some(Cue::Failure)
    );
    assert_eq!(loudest(&[Cue::Done, Cue::Done]), Some(Cue::Done));
    assert_eq!(loudest(&[]), None);
}
