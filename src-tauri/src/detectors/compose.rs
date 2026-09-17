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
mod tests;
