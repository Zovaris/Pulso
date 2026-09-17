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
    TaskfileDetector
        .detect(&fixture(name))
        .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
}

#[test]
fn every_task_becomes_a_task_command() {
    let commands = detect("task-project");
    let dev = commands
        .iter()
        .find(|command| command.label == "dev")
        .expect("dev should be detected");

    assert_eq!(dev.id, "taskfile:dev");
    assert_eq!(dev.program, "task");
    assert_eq!(dev.args, vec!["dev".to_string()]);
    assert_eq!(dev.category, CommandCategory::Dev);
    assert!(dev.long_running);
    assert!(dev.source.ends_with("Taskfile.yml"));
}

#[test]
fn a_task_written_as_a_mapping_counts_as_one() {
    let commands = detect("task-project");
    let labels: Vec<&str> = commands
        .iter()
        .map(|command| command.label.as_str())
        .collect();

    assert!(labels.contains(&"migrate"));
    assert!(labels.contains(&"test"));
}

#[test]
fn internal_tasks_stay_out_of_the_list() {
    let commands = detect("task-project");
    let labels: Vec<&str> = commands
        .iter()
        .map(|command| command.label.as_str())
        .collect();

    assert!(!labels.contains(&"_internal"));
}

#[test]
fn a_file_that_is_not_yaml_is_reported() {
    let broken = TaskfileDetector.detect(&fixture("half-broken-project"));
    assert!(matches!(broken, Err(DetectError::Missing)));
}

#[test]
fn the_project_folder_says_which_it_is() {
    let missing = TaskfileDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(9, &fixture("task-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
}
