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
mod tests;
