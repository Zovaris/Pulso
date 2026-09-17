use std::path::Path;

use serde_json::Value;

use super::naming;
use super::{manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "composer_json";
pub const LABEL: &str = "composer.json";

const NAMES: [&str; 1] = ["composer.json"];

pub struct ComposerJsonDetector;

impl CommandDetector for ComposerJsonDetector {
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

        let value: Value = serde_json::from_str(&raw)
            .map_err(|error| DetectError::Invalid(format!("{LABEL} is not valid JSON: {error}")))?;

        let source = paths::as_string(&manifest);
        let cwd = paths::as_string(project_dir);

        let mut commands: Vec<DetectedCommand> = scripts(&value)
            .into_iter()
            .map(|script| DetectedCommand {
                id: format!("{ID}:{script}"),
                label: script.to_string(),
                program: "composer".to_string(),
                args: vec!["run-script".to_string(), script.to_string()],
                cwd: cwd.clone(),
                source: source.clone(),
                detector: ID.to_string(),
                category: naming::categorize(script),
                long_running: naming::is_long_running(script),
            })
            .collect();

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn scripts(manifest: &Value) -> Vec<&str> {
    let Some(scripts) = manifest.get("scripts").and_then(Value::as_object) else {
        return Vec::new();
    };

    scripts
        .iter()
        .filter(|(_, body)| body.is_string() || body.is_array())
        .map(|(name, _)| name.as_str())
        .collect()
}

#[cfg(test)]
mod tests;
