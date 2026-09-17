use super::*;
use crate::detectors::scan;
use crate::domain::command::ScanStatus;

fn fixture(name: &str) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("tests")
        .join("fixtures")
        .join(name)
}

fn detect(name: &str) -> Vec<DetectedCommand> {
    DenoJsonDetector
        .detect(&fixture(name))
        .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
}

#[test]
fn every_task_becomes_a_deno_command() {
    let commands = detect("deno-project");
    let dev = commands
        .iter()
        .find(|command| command.label == "dev")
        .expect("dev should be detected");

    assert_eq!(dev.id, "deno_json:dev");
    assert_eq!(dev.program, "deno");
    assert_eq!(dev.args, vec!["task".to_string(), "dev".to_string()]);
    assert!(dev.long_running);
}

#[test]
fn the_commented_flavour_parses_too() {
    let commands = detect("deno-project");
    let labels: Vec<&str> = commands.iter().map(|c| c.label.as_str()).collect();

    assert!(labels.contains(&"check"));
}

#[test]
fn comments_go_away_and_strings_are_left_alone() {
    let raw = "{\n  // a line comment\n  \"imports\": {\n    \"x\": \"https://esm.sh/x\" /* block */\n  },\n  \"scoped\": \"soffy://with//slashes\"\n}\n";

    let clean = without_comments(raw);
    let value: Value = serde_json::from_str(&clean).expect("the cleaned text should parse");

    assert_eq!(value["imports"]["x"], "https://esm.sh/x");
    assert_eq!(value["scoped"], "soffy://with//slashes");
}

#[test]
fn an_escape_inside_a_string_does_not_end_it() {
    let clean = without_comments("{\"a\": \"one \\\" // two\"}");

    assert_eq!(clean, "{\"a\": \"one \\\" // two\"}");
}

#[test]
fn a_manifest_without_tasks_declares_nothing() {
    assert!(detect("bare-project").is_empty());
}

#[test]
fn the_project_folder_says_which_it_is() {
    let missing = DenoJsonDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(8, &fixture("deno-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
}
