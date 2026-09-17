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
    ProcfileDetector
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
fn every_process_type_becomes_a_command() {
    let commands = detect("proc-project");

    assert_eq!(commands.len(), 4);
    let web = command(&commands, "web");
    assert_eq!(web.id, "procfile:web");
    assert_eq!(web.program, "bun");
    assert_eq!(web.args, vec!["run".to_string(), "dev".to_string()]);
    assert!(web.source.ends_with("Procfile"));
}

#[test]
fn a_process_is_long_running_unless_it_is_a_one_shot() {
    let commands = detect("proc-project");

    assert!(command(&commands, "web").long_running);
    assert!(command(&commands, "worker").long_running);
    assert!(!command(&commands, "release").long_running);
    assert!(!command(&commands, "assets").long_running);
}

#[test]
fn a_compound_line_goes_through_the_shell() {
    let (program, args) = invocation("NODE_ENV=production bun run dev");
    assert_eq!(program, "sh");
    assert_eq!(args, vec!["-c", "NODE_ENV=production bun run dev"]);

    let (program, args) = invocation("bun run dev | tee dev.log");
    assert_eq!(program, "sh");
    assert_eq!(args, vec!["-c", "bun run dev | tee dev.log"]);
}

#[test]
fn a_plain_line_keeps_its_arguments_apart() {
    let (program, args) = invocation("bun run dev --host");

    assert_eq!(program, "bun");
    assert_eq!(args, vec!["run", "dev", "--host"]);
}

#[test]
fn quotes_do_not_break_the_arguments() {
    let (program, args) = invocation("node -e 'console.log(1)'");

    assert_eq!(program, "node");
    assert_eq!(args, vec!["-e", "console.log(1)"]);
}

#[test]
fn comments_and_blank_lines_are_not_processes() {
    let contents = "\
# a Procfile

web: bun run dev
broken:

unreadable line without a colon
";

    let found = entries(contents);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].name, "web");
}

#[test]
fn the_project_folder_says_which_it_is() {
    let missing = ProcfileDetector.detect(&fixture("empty-project"));
    assert!(matches!(missing, Err(DetectError::Missing)));

    let scan = scan(5, &fixture("proc-project"));
    assert_eq!(scan.status, ScanStatus::Detected);
}
