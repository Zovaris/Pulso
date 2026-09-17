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
    MakefileDetector
        .detect(&fixture(name))
        .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
}

#[test]
fn every_rule_becomes_a_target() {
    let commands = detect("make-project");
    let labels: Vec<&str> = commands
        .iter()
        .map(|command| command.label.as_str())
        .collect();

    for target in [
        "dev",
        "build",
        "test",
        "test-watch",
        "lint",
        "deploy",
        "db/migrate",
    ] {
        assert!(labels.contains(&target), "{target} should be detected");
    }
}

#[test]
fn a_target_runs_through_make() {
    let commands = detect("make-project");
    let dev = commands
        .iter()
        .find(|command| command.label == "dev")
        .expect("dev should be detected");

    assert_eq!(dev.id, "makefile:dev");
    assert_eq!(dev.detector, "makefile");
    assert_eq!(dev.program, "make");
    assert_eq!(dev.args, vec!["dev".to_string()]);
    assert!(dev.source.ends_with("Makefile"));
    assert_eq!(dev.category, CommandCategory::Dev);
    assert!(dev.long_running);
}

#[test]
fn assignments_specials_and_patterns_are_not_targets() {
    let contents = "\
SHELL := /bin/bash
FMT = prettier --write
override HERE := $(CURDIR)
.PHONY: dev
.DEFAULT_GOAL := dev
include other.mk
-include optional.mk
deploy-%.zip: build
dev: build
";

    assert_eq!(targets(contents), vec!["dev"]);
}

#[test]
fn a_recipe_body_is_never_read_as_a_rule() {
    let contents = "\
dev:
	@echo start
	$(FMT) .
build: dev
";

    assert_eq!(targets(contents), vec!["dev", "build"]);
}

#[test]
fn several_targets_on_one_line_all_count() {
    let contents = "start stop: build\n";

    assert_eq!(targets(contents), vec!["start", "stop"]);
}

#[test]
fn the_habits_of_a_makefile_show_up_in_the_order() {
    let labels: Vec<String> = detect("make-project")
        .into_iter()
        .map(|command| command.label)
        .collect();

    let index = |label: &str| labels.iter().position(|it| it == label).unwrap();
    assert_eq!(labels[0], "dev");
    assert!(index("test-watch") < index("test"));
    assert!(index("test") < index("build"));
    assert!(index("build") < index("deploy"));
}

#[test]
fn the_project_folder_decides_missing_from_declared() {
    let missing = MakefileDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(3, &fixture("make-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
    assert!(!scan.commands.is_empty());
}
