use std::path::Path;

use super::naming;
use super::{CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "makefile";
pub const LABEL: &str = "Makefile";

const NAMES: [&str; 3] = ["Makefile", "makefile", "GNUmakefile"];

pub struct MakefileDetector;

impl CommandDetector for MakefileDetector {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        LABEL
    }

    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError> {
        let manifest = NAMES
            .iter()
            .map(|name| project_dir.join(name))
            .find(|candidate| candidate.is_file())
            .ok_or(DetectError::Missing)?;

        let raw = std::fs::read_to_string(&manifest).map_err(|error| {
            DetectError::Unreadable(format!("{LABEL} could not be read: {error}"))
        })?;

        let source = paths::as_string(&manifest);
        let cwd = paths::as_string(project_dir);

        let mut commands: Vec<DetectedCommand> = targets(&raw)
            .into_iter()
            .map(|target| DetectedCommand {
                id: format!("{ID}:{target}"),
                label: target.to_string(),
                program: "make".to_string(),
                args: vec![target.to_string()],
                cwd: cwd.clone(),
                source: source.clone(),
                detector: ID.to_string(),
                category: naming::categorize(target),
                long_running: naming::is_long_running(target),
            })
            .collect();

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn is_name(character: char) -> bool {
    character.is_alphanumeric() || matches!(character, '_' | '-' | '.' | '/')
}

fn targets(contents: &str) -> Vec<&str> {
    let mut found: Vec<&str> = Vec::new();

    for line in contents.lines() {
        if line.is_empty() || line.starts_with('#') || line.starts_with(char::is_whitespace) {
            continue;
        }

        let Some((declared, rest)) = line.split_once(':') else {
            continue;
        };

        if rest.trim_start().starts_with('=') {
            continue;
        }

        for name in declared.split_whitespace() {
            if name.starts_with('.') || name.starts_with('-') {
                continue;
            }
            if !name.chars().all(is_name) || name.chars().all(|c| c.is_ascii_digit()) {
                continue;
            }
            if !found.contains(&name) {
                found.push(name);
            }
        }
    }

    found
}

#[cfg(test)]
mod tests;
