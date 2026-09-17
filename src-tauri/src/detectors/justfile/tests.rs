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
    JustfileDetector
        .detect(&fixture(name))
        .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
}

fn labels(name: &str) -> Vec<String> {
    detect(name)
        .into_iter()
        .map(|command| command.label)
        .collect()
}

#[test]
fn every_runnable_recipe_becomes_a_command() {
    let labels = labels("just-project");

    for recipe in ["dev", "build", "test", "test-all"] {
        assert!(
            labels.contains(&recipe.to_string()),
            "{recipe} should be detected"
        );
    }
}

#[test]
fn a_recipe_runs_through_just() {
    let commands = detect("just-project");
    let dev = commands
        .iter()
        .find(|command| command.label == "dev")
        .expect("dev should be detected");

    assert_eq!(dev.id, "justfile:dev");
    assert_eq!(dev.detector, "justfile");
    assert_eq!(dev.program, "just");
    assert_eq!(dev.args, vec!["dev".to_string()]);
    assert!(dev.source.ends_with("justfile"));
    assert_eq!(dev.category, CommandCategory::Dev);
    assert!(dev.long_running);
}

#[test]
fn private_recipes_stay_private() {
    assert!(!labels("just-project").contains(&"_deploy".to_string()));
}

#[test]
fn a_recipe_that_needs_an_argument_is_left_out() {
    assert!(!labels("just-project").contains(&"release".to_string()));
    assert!(!labels("just-project").contains(&"promote".to_string()));
}

#[test]
fn settings_aliases_and_assignments_are_not_recipes() {
    let contents = "\
set shell := [\"bash\", \"-c\"]
alias b := build
export TOKEN := \"secret\"
mod shared
import 'other.just'
include other.just
dev:
	just --list
";

    assert_eq!(recipes(contents), vec!["dev"]);
}

#[test]
fn a_parameter_with_a_default_still_runs_bare() {
    assert_eq!(recipes("test filter=\"\":\n\tbun test\n"), vec!["test"]);
    assert_eq!(recipes("test-all *args:\n\tbun test\n"), vec!["test-all"]);
    assert!(recipes("run second:\n\tbin\n").is_empty());
}

#[test]
fn the_project_folder_says_which_it_is() {
    let missing = JustfileDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(4, &fixture("just-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
}
