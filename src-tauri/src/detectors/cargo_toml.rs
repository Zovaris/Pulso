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
mod tests;
