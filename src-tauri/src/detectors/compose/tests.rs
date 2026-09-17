use super::*;
use crate::detectors::scan;
use crate::domain::command::{CommandCategory, ScanStatus};

fn fixture(name: &str) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("tests")
        .join("fixtures")
        .join(name)
}

fn detect(name: &str) -> Vec<DetectedCommand> {
    ComposeDetector
        .detect(&fixture(name))
        .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
}

fn command<'a>(commands: &'a [DetectedCommand], label: &str) -> &'a DetectedCommand {
    commands
        .iter()
        .find(|command| command.label == label)
        .unwrap_or_else(|| panic!("{label} should be detected"))
}

#[test]
fn bringing_the_stack_up_leads_the_list() {
    let commands = detect("compose-project");

    assert_eq!(commands[0].label, "up");
    assert_eq!(commands[0].program, "docker");
    assert_eq!(
        commands[0].args,
        vec!["compose".to_string(), "up".to_string()]
    );
    assert_eq!(commands[0].category, CommandCategory::Dev);
    assert!(commands[0].long_running);
}

#[test]
fn every_declared_service_can_start_on_its_own() {
    let commands = detect("compose-project");
    let database = command(&commands, "up:database");

    assert_eq!(
        database.args,
        vec![
            "compose".to_string(),
            "up".to_string(),
            "database".to_string()
        ]
    );
    assert!(database.long_running);
}

#[test]
fn taking_the_stack_down_is_a_one_shot_step() {
    let commands = detect("compose-project");
    let down = command(&commands, "down");

    assert!(!down.long_running);
    assert_eq!(down.category, CommandCategory::Infrastructure);
}

#[test]
fn following_the_logs_is_long_running() {
    let commands = detect("compose-project");

    assert!(command(&commands, "logs").long_running);
}

#[test]
fn the_project_folder_says_which_it_is() {
    let missing = ComposeDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(10, &fixture("compose-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
}
