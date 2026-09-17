use std::path::Path;

use toml::{Table, Value};

use super::naming;
use super::{manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "cargo_toml";
pub const LABEL: &str = "Cargo.toml";

const NAMES: [&str; 1] = ["Cargo.toml"];

const VERBS: [&str; 4] = ["build", "test", "clippy", "fmt"];

pub struct CargoTomlDetector;

impl CommandDetector for CargoTomlDetector {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        LABEL
    }

    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError> {
        let Some(path) = manifest(project_dir, &NAMES) else {
            return Err(DetectError::Missing);
        };

        let raw = std::fs::read_to_string(&path).map_err(|error| {
            DetectError::Unreadable(format!("{LABEL} could not be read: {error}"))
        })?;

        let manifest: Table = raw
            .parse()
            .map_err(|error| DetectError::Invalid(format!("{LABEL} is not valid TOML: {error}")))?;

        let source = paths::as_string(&path);
        let cwd = paths::as_string(project_dir);

        let mut commands: Vec<DetectedCommand> = Vec::new();
        let mut push = |label: String, args: Vec<String>| {
            commands.push(DetectedCommand {
                id: format!("{ID}:{label}"),
                label: label.clone(),
                program: "cargo".to_string(),
                args,
                cwd: cwd.clone(),
                source: source.clone(),
                detector: ID.to_string(),
                category: naming::categorize(&label),
                long_running: naming::is_long_running(&label),
            });
        };

        let named = |verb: &str| vec![verb.to_string()];

        if manifest.get("package").is_some() {
            push("run".to_string(), named("run"));
        }

        for verb in VERBS {
            push(verb.to_string(), named(verb));
        }

        for binary in binaries(&manifest) {
            push(
                format!("run:{binary}"),
                vec!["run".to_string(), "--bin".to_string(), binary.to_string()],
            );
        }

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn binaries(manifest: &Table) -> Vec<&str> {
    let Some(binaries) = manifest.get("bin").and_then(Value::as_array) else {
        return Vec::new();
    };

    binaries
        .iter()
        .filter_map(|entry| entry.get("name").and_then(Value::as_str))
        .collect()
}

#[cfg(test)]
mod tests {
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
        CargoTomlDetector
            .detect(&fixture(name))
            .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
    }

    fn labels(name: &str) -> Vec<String> {
        detect(name)
            .into_iter()
            .map(|command| command.label)
            .collect()
    }

    fn command<'a>(commands: &'a [DetectedCommand], label: &str) -> &'a DetectedCommand {
        commands
            .iter()
            .find(|command| command.label == label)
            .unwrap_or_else(|| panic!("{label} should be detected"))
    }

    #[test]
    fn a_package_gets_the_verbs_a_rust_project_expects() {
        let commands = detect("rust-project");

        for verb in ["run", "build", "test", "clippy", "fmt"] {
            assert!(labels("rust-project").contains(&verb.to_string()), "{verb}");
        }

        let test = command(&commands, "test");
        assert_eq!(test.id, "cargo_toml:test");
        assert_eq!(test.program, "cargo");
        assert_eq!(test.args, vec!["test".to_string()]);
        assert_eq!(test.category, CommandCategory::Test);
        assert!(test.source.ends_with("Cargo.toml"));
    }

    #[test]
    fn a_server_binary_leads_the_dev_group_but_a_plain_run_does_not_promise_to_stay() {
        let commands = detect("rust-project");
        let run = command(&commands, "run");

        assert_eq!(commands[0].label, "run:server");
        assert_eq!(run.category, CommandCategory::Dev);
        assert!(!run.long_running);
    }

    #[test]
    fn a_server_binary_says_it_keeps_running() {
        let commands = detect("rust-project");
        let server = command(&commands, "run:server");

        assert!(server.long_running);
        assert_eq!(
            server.args,
            vec!["run".to_string(), "--bin".to_string(), "server".to_string()]
        );
    }

    #[test]
    fn a_workspace_without_a_package_offers_no_run() {
        let labels = labels("workspace-project");

        assert!(!labels.contains(&"run".to_string()));
        assert!(labels.contains(&"build".to_string()));
        assert!(labels.contains(&"test".to_string()));
    }

    #[test]
    fn a_broken_manifest_is_reported_as_invalid() {
        let broken = CargoTomlDetector.detect(&fixture("bad-toml-project"));

        assert!(matches!(broken, Err(DetectError::Invalid(_))));
    }

    #[test]
    fn the_project_folder_says_which_it_is() {
        let missing = CargoTomlDetector.detect(&fixture("empty-project"));
        assert!(matches!(missing, Err(DetectError::Missing)));

        let scan = scan(11, &fixture("rust-project"));
        assert_eq!(scan.status, ScanStatus::Detected);
    }
}
