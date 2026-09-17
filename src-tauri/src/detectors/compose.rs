use std::path::Path;

use yaml_rust2::{Yaml, YamlLoader};

use super::naming;
use super::{declared_keys, manifest, CommandDetector, DetectError};
use crate::domain::command::{CommandCategory, DetectedCommand};
use crate::support::paths;

pub const ID: &str = "compose";
pub const LABEL: &str = "compose.yml";

const NAMES: [&str; 4] = [
    "compose.yml",
    "compose.yaml",
    "docker-compose.yml",
    "docker-compose.yaml",
];

pub struct ComposeDetector;

impl CommandDetector for ComposeDetector {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        LABEL
    }

    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError> {
        let Some(manifest) = manifest(project_dir, &NAMES) else {
            return Err(DetectError::Missing);
        };

        let raw = std::fs::read_to_string(&manifest).map_err(|error| {
            DetectError::Unreadable(format!("{LABEL} could not be read: {error}"))
        })?;

        let document = YamlLoader::load_from_str(&raw)
            .map_err(|error| DetectError::Invalid(format!("{LABEL} is not valid YAML: {error}")))?;

        let source = paths::as_string(&manifest);
        let cwd = paths::as_string(project_dir);
        let build = |label: String,
                     args: Vec<String>,
                     category: CommandCategory,
                     long_running: bool| DetectedCommand {
            id: format!("{ID}:{label}"),
            label: label.clone(),
            program: "docker".to_string(),
            args,
            cwd: cwd.clone(),
            source: source.clone(),
            detector: ID.to_string(),
            category,
            long_running,
        };

        let mut commands = vec![
            build(
                "up".to_string(),
                vec!["compose".to_string(), "up".to_string()],
                CommandCategory::Dev,
                true,
            ),
            build(
                "logs".to_string(),
                vec!["compose".to_string(), "logs".to_string(), "-f".to_string()],
                CommandCategory::Infrastructure,
                true,
            ),
            build(
                "down".to_string(),
                vec!["compose".to_string(), "down".to_string()],
                CommandCategory::Infrastructure,
                false,
            ),
        ];

        for service in services(&document) {
            commands.push(build(
                format!("up:{service}"),
                vec!["compose".to_string(), "up".to_string(), service.to_string()],
                CommandCategory::Dev,
                true,
            ));
        }

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn services(document: &[Yaml]) -> Vec<&str> {
    declared_keys(document, "services")
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
}
