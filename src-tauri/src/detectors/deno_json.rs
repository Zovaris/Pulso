use std::path::Path;

use serde_json::Value;

use super::naming;
use super::{manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "deno_json";
pub const LABEL: &str = "deno.json";

const NAMES: [&str; 2] = ["deno.json", "deno.jsonc"];

pub struct DenoJsonDetector;

impl CommandDetector for DenoJsonDetector {
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

        let value: Value = serde_json::from_str(&without_comments(&raw))
            .map_err(|error| DetectError::Invalid(format!("{LABEL} is not valid JSON: {error}")))?;

        let source = paths::as_string(&manifest);
        let cwd = paths::as_string(project_dir);

        let mut commands: Vec<DetectedCommand> = tasks(&value)
            .into_iter()
            .map(|task| DetectedCommand {
                id: format!("{ID}:{task}"),
                label: task.to_string(),
                program: "deno".to_string(),
                args: vec!["task".to_string(), task.to_string()],
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

fn tasks(manifest: &Value) -> Vec<&str> {
    let Some(tasks) = manifest.get("tasks").and_then(Value::as_object) else {
        return Vec::new();
    };

    tasks
        .iter()
        .filter(|(_, body)| body.is_string() || body.is_object())
        .map(|(name, _)| name.as_str())
        .collect()
}

fn without_comments(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut characters = raw.chars().peekable();
    let mut quoted = false;
    let mut escaped = false;

    while let Some(character) = characters.next() {
        if quoted {
            out.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                quoted = false;
            }
            continue;
        }

        if character == '"' {
            quoted = true;
            out.push(character);
            continue;
        }

        if character != '/' {
            out.push(character);
            continue;
        }

        match characters.peek() {
            Some('/') => {
                for peeked in characters.by_ref() {
                    if peeked == '\n' {
                        out.push('\n');
                        break;
                    }
                }
            }
            Some('*') => {
                characters.next();
                while let Some(peeked) = characters.next() {
                    if peeked == '*' && characters.peek() == Some(&'/') {
                        characters.next();
                        break;
                    }
                }
            }
            _ => out.push(character),
        }
    }

    out
}

#[cfg(test)]
mod tests;
