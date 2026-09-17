use super::*;
use crate::detectors::{scan, CommandDetector, DetectError};
use crate::domain::command::{CommandCategory, ScanStatus};

fn fixture(name: &str) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("tests")
        .join("fixtures")
        .join(name)
}

fn detect(name: &str) -> Vec<DetectedCommand> {
    PackageJsonDetector
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
fn every_script_becomes_a_command_with_separate_arguments() {
    let commands = detect("node-project");
    assert_eq!(commands.len(), 10);

    let dev = command(&commands, "dev");
    assert_eq!(dev.id, "package_json:dev");
    assert_eq!(dev.detector, "package_json");
    assert_eq!(dev.program, "bun");
    assert_eq!(dev.args, vec!["run".to_string(), "dev".to_string()]);
    assert!(dev.cwd.ends_with("node-project"));
    assert!(dev.source.ends_with("package.json"));
    assert_eq!(dev.category, CommandCategory::Dev);
    assert!(dev.long_running);
}

#[test]
fn servers_come_before_one_shot_steps() {
    let commands = detect("node-project");
    let labels: Vec<&str> = commands.iter().map(|c| c.label.as_str()).collect();

    let index = |label: &str| labels.iter().position(|it| *it == label).unwrap();
    assert_eq!(labels[0], "dev");
    assert!(index("dev") < index("db:migrate"));
    assert!(index("db:migrate") < index("build"));

    let ranks: Vec<u8> = commands.iter().map(|c| c.category.rank()).collect();
    assert!(ranks.windows(2).all(|pair| pair[0] <= pair[1]));
}

#[test]
fn categories_read_the_words_in_the_script_name() {
    let commands = detect("node-project");

    assert_eq!(
        command(&commands, "db:migrate").category,
        CommandCategory::Database
    );
    assert_eq!(
        command(&commands, "test:e2e").category,
        CommandCategory::Test
    );
    assert_eq!(command(&commands, "lint").category, CommandCategory::Lint);
    assert_eq!(
        command(&commands, "typecheck").category,
        CommandCategory::Lint
    );
    assert_eq!(command(&commands, "build").category, CommandCategory::Build);
    assert_eq!(
        command(&commands, "deploy").category,
        CommandCategory::Infrastructure
    );
    assert_eq!(
        command(&commands, "prepare").category,
        CommandCategory::Other
    );
}

#[test]
fn long_running_is_about_the_verb_not_the_category() {
    let commands = detect("node-project");

    assert!(command(&commands, "preview").long_running);
    assert!(!command(&commands, "test").long_running);
    assert!(!command(&commands, "test:e2e").long_running);
    assert!(!command(&commands, "build").long_running);
}

#[test]
fn a_declared_package_manager_wins_over_lockfiles() {
    let commands = detect("pnpm-project");
    assert_eq!(command(&commands, "start").program, "pnpm");
    assert!(command(&commands, "watch:css").long_running);
}

#[test]
fn the_lockfile_names_the_manager_and_npm_is_the_last_resort() {
    assert_eq!(command(&detect("node-project"), "dev").program, "bun");
    assert_eq!(command(&detect("plain-project"), "build").program, "npm");
}

#[test]
fn a_script_value_that_is_not_a_string_is_skipped() {
    let commands = detect("plain-project");
    assert_eq!(commands.len(), 2);
    assert_eq!(
        command(&commands, "db_seed").category,
        CommandCategory::Database
    );
}

#[test]
fn a_project_without_a_manifest_says_what_is_missing() {
    let missing = PackageJsonDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(7, &fixture("empty-project"));
    assert_eq!(scan.project_id, 7);
    assert_eq!(scan.status, ScanStatus::NoManifest);
    assert!(scan.commands.is_empty());
    assert!(scan.detail.is_some());
}

#[test]
fn a_manifest_without_scripts_is_reported_as_such() {
    let scan = scan(1, &fixture("bare-project"));
    assert_eq!(scan.status, ScanStatus::NoCommands);
    assert!(scan.commands.is_empty());
}

#[test]
fn a_broken_manifest_reports_the_parse_failure() {
    let scan = scan(1, &fixture("broken-project"));
    assert_eq!(scan.status, ScanStatus::InvalidManifest);
    let detail = scan.detail.unwrap_or_default();
    assert!(detail.contains("not valid JSON"), "{detail}");
}

#[test]
fn a_folder_that_is_gone_is_unavailable() {
    let scan = scan(1, std::path::Path::new("/pulso/does/not/exist"));
    assert_eq!(scan.status, ScanStatus::Unavailable);
}
