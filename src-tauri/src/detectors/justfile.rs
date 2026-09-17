use std::path::Path;

use super::naming;
use super::{manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "justfile";
pub const LABEL: &str = "justfile";

const NAMES: [&str; 3] = ["justfile", "Justfile", ".justfile"];

const KEYWORDS: [&str; 8] = [
    "alias", "assert", "export", "import", "mod", "set", "unexport", "windows",
];

pub struct JustfileDetector;

impl CommandDetector for JustfileDetector {
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

        let source = paths::as_string(&manifest);
        let cwd = paths::as_string(project_dir);

        let mut commands: Vec<DetectedCommand> = recipes(&raw)
            .into_iter()
            .map(|recipe| DetectedCommand {
                id: format!("{ID}:{recipe}"),
                label: recipe.to_string(),
                program: "just".to_string(),
                args: vec![recipe.to_string()],
                cwd: cwd.clone(),
                source: source.clone(),
                detector: ID.to_string(),
                category: naming::categorize(recipe),
                long_running: naming::is_long_running(recipe),
            })
            .collect();

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn runs_without_arguments(parameters: &[&str]) -> bool {
    parameters
        .iter()
        .all(|parameter| parameter.contains('=') || parameter.starts_with('*'))
}

fn recipes(contents: &str) -> Vec<&str> {
    let mut found: Vec<&str> = Vec::new();

    for line in contents.lines() {
        if line.is_empty() || line.starts_with('#') || line.starts_with(char::is_whitespace) {
            continue;
        }

        let Some((signature, rest)) = line.split_once(':') else {
            continue;
        };

        if rest.trim_start().starts_with('=') {
            continue;
        }

        let mut signature = signature.split_whitespace();
        let Some(name) = signature.next() else {
            continue;
        };
        let parameters: Vec<&str> = signature.collect();

        if name.starts_with('_') || KEYWORDS.contains(&name) {
            continue;
        }
        if !name
            .chars()
            .all(|character| character.is_alphanumeric() || character == '-' || character == '_')
        {
            continue;
        }
        if !runs_without_arguments(&parameters) {
            continue;
        }
        if !found.contains(&name) {
            found.push(name);
        }
    }

    found
}

#[cfg(test)]
mod tests;
