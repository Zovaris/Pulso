use super::*;
use crate::domain::command::{CommandCategory, DetectedCommand};

fn run(id: i64, command: &str, state: ExecutionState, at: i64) -> Execution {
    let detected = DetectedCommand {
        id: command.to_string(),
        label: command.to_string(),
        program: "bun".to_string(),
        args: Vec::new(),
        cwd: "/tmp".to_string(),
        source: "package.json".to_string(),
        detector: "package_json".to_string(),
        category: CommandCategory::Test,
        long_running: false,
    };
    let mut execution = Execution::new(id, 1, &detected, at);
    execution.state = state;
    execution.ended_at = Some(at + 10);
    execution
}

#[test]
fn only_failures_after_the_last_look_are_waiting() {
    let runs = [
        run(1, "test", ExecutionState::Failed, 100),
        run(2, "lint", ExecutionState::Failed, 500),
        run(3, "build", ExecutionState::Exited, 600),
    ];

    assert_eq!(unseen(&runs, 0), 2);
    assert_eq!(unseen(&runs, 300), 1);
    assert_eq!(unseen(&runs, 1_000), 0);
}

#[test]
fn running_a_failed_command_again_takes_it_off_the_list() {
    let runs = [
        run(1, "test", ExecutionState::Failed, 100),
        run(2, "test", ExecutionState::Running, 200),
    ];

    assert_eq!(unseen(&runs, 0), 0);
}
