use std::path::Path;

use serde_json::Value;

use super::naming;
use super::{CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "package_json";
pub const LABEL: &str = "package.json";

pub struct PackageJsonDetector;

impl CommandDetector for PackageJsonDetector {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        LABEL
    }

    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError> {
        detect(self, project_dir)
    }
}

fn detect(
    detector: &dyn CommandDetector,
    project_dir: &Path,
) -> std::result::Result<Vec<DetectedCommand>, DetectError> {
    let manifest = project_dir.join(LABEL);
    if !manifest.is_file() {
        return Err(DetectError::Missing);
    }

    let raw = std::fs::read_to_string(&manifest)
        .map_err(|error| DetectError::Unreadable(format!("{LABEL} could not be read: {error}")))?;

    let value: Value = serde_json::from_str(&raw)
        .map_err(|error| DetectError::Invalid(format!("{LABEL} is not valid JSON: {error}")))?;

    let Some(scripts) = value.get("scripts").and_then(Value::as_object) else {
        return Ok(Vec::new());
    };

    let program = package_manager(&value, project_dir);
    let cwd = paths::as_string(project_dir);
    let source = paths::as_string(&manifest);

    let mut commands: Vec<DetectedCommand> = scripts
        .iter()
        .filter(|(_, body)| body.is_string())
        .map(|(name, _)| DetectedCommand {
            id: format!("{}:{name}", detector.id()),
            label: name.clone(),
            program: program.clone(),
            args: vec!["run".to_string(), name.clone()],
            cwd: cwd.clone(),
            source: source.clone(),
            detector: detector.id().to_string(),
            category: naming::categorize(name),
            long_running: naming::is_long_running(name),
        })
        .collect();

    naming::sort_commands(&mut commands);

    Ok(commands)
}

fn package_manager(manifest: &Value, project_dir: &Path) -> String {
    const KNOWN: [&str; 4] = ["bun", "pnpm", "yarn", "npm"];

    if let Some(name) = manifest
        .get("packageManager")
        .and_then(Value::as_str)
        .and_then(|field| field.split('@').next())
    {
        if KNOWN.contains(&name) {
            return name.to_string();
        }
    }

    const LOCKFILES: [(&str, &str); 5] = [
        ("bun.lockb", "bun"),
        ("bun.lock", "bun"),
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
        ("package-lock.json", "npm"),
    ];

    for (file, manager) in LOCKFILES {
        if project_dir.join(file).is_file() {
            return manager.to_string();
        }
    }

    "npm".to_string()
}

#[cfg(test)]
mod tests;
