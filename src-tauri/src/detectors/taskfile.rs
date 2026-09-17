use std::path::Path;

use yaml_rust2::{Yaml, YamlLoader};

use super::naming;
use super::{declared_keys, manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "taskfile";
pub const LABEL: &str = "Taskfile.yml";

const NAMES: [&str; 4] = [
    "Taskfile.yml",
    "Taskfile.yaml",
    "taskfile.yml",
    "taskfile.yaml",
];

pub struct TaskfileDetector;

impl CommandDetector for TaskfileDetector {
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

        let mut commands: Vec<DetectedCommand> = tasks(&document)
            .into_iter()
            .map(|task| DetectedCommand {
                id: format!("{ID}:{task}"),
                label: task.to_string(),
                program: "task".to_string(),
                args: vec![task.to_string()],
                cwd: cwd.clone(),
                source: source.clone(),
                detector: ID.to_string(),
                category: naming::categorize(task),
                long_running: naming::is_long_running(task),
            })
            .collect();

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn tasks(document: &[Yaml]) -> Vec<&str> {
    declared_keys(document, "tasks")
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
}
