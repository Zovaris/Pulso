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
    ComposerJsonDetector
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
fn every_script_becomes_a_composer_command() {
    let commands = detect("php-project");

    let test = command(&commands, "test");
    assert_eq!(test.id, "composer_json:test");
    assert_eq!(test.program, "composer");
    assert_eq!(
        test.args,
        vec!["run-script".to_string(), "test".to_string()]
    );
    assert_eq!(test.category, CommandCategory::Test);
    assert!(test.source.ends_with("composer.json"));
}

#[test]
fn a_script_that_is_a_list_of_steps_still_counts() {
    let commands = detect("php-project");

    assert_eq!(command(&commands, "checks").args[1], "checks");
}

#[test]
fn a_manifest_without_scripts_declares_nothing() {
    assert!(detect("bare-project").is_empty());
}

#[test]
fn a_broken_manifest_is_reported_as_invalid() {
    let broken = ComposerJsonDetector.detect(&fixture("broken-project"));
    assert!(matches!(broken, Err(DetectError::Missing)));
}

#[test]
fn the_project_folder_says_which_it_is() {
    let missing = ComposerJsonDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(6, &fixture("php-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
}
