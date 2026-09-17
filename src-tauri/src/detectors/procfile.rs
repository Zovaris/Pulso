use std::path::Path;

use super::naming;
use super::{manifest, CommandDetector, DetectError};
use crate::domain::command::DetectedCommand;
use crate::support::paths;

pub const ID: &str = "procfile";
pub const LABEL: &str = "Procfile";

const NAMES: [&str; 1] = ["Procfile"];

const ONE_SHOT: [&str; 6] = [
    "assets",
    "assets:precompile",
    "migrate",
    "release",
    "seed",
    "setup",
];

const SHELL: [char; 9] = ['|', '&', ';', '<', '>', '$', '(', ')', '`'];

pub struct ProcfileDetector;

pub struct Entry<'a> {
    pub name: &'a str,
    pub command: &'a str,
}

impl CommandDetector for ProcfileDetector {
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

        let mut commands: Vec<DetectedCommand> = entries(&raw)
            .into_iter()
            .map(|entry| {
                let (program, args) = invocation(entry.command);

                DetectedCommand {
                    id: format!("{ID}:{}", entry.name),
                    label: entry.name.to_string(),
                    program,
                    args,
                    cwd: cwd.clone(),
                    source: source.clone(),
                    detector: ID.to_string(),
                    category: naming::categorize(entry.name),
                    long_running: !ONE_SHOT.contains(&entry.name),
                }
            })
            .collect();

        naming::sort_commands(&mut commands);

        Ok(commands)
    }
}

fn entries(contents: &str) -> Vec<Entry<'_>> {
    let mut found: Vec<Entry<'_>> = Vec::new();

    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let Some((name, command)) = line.split_once(':') else {
            continue;
        };

        let name = name.trim();
        let command = command.trim();
        if name.is_empty() || command.is_empty() {
            continue;
        }
        if !name
            .chars()
            .all(|character| character.is_alphanumeric() || character == '-' || character == '_')
        {
            continue;
        }

        found.push(Entry { name, command });
    }

    found
}

fn split(command: &str) -> (Vec<String>, bool) {
    let mut words: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut compound = false;

    for character in command.chars() {
        if let Some(open) = quote {
            if character == open {
                quote = None;
            } else {
                current.push(character);
            }
            continue;
        }

        if character == '"' || character == '\'' {
            quote = Some(character);
        } else if character.is_whitespace() {
            if !current.is_empty() {
                words.push(std::mem::take(&mut current));
            }
        } else {
            if SHELL.contains(&character) {
                compound = true;
            }
            current.push(character);
        }
    }

    if !current.is_empty() {
        words.push(current);
    }

    (words, compound)
}

fn through_a_shell(command: &str) -> (String, Vec<String>) {
    (
        "sh".to_string(),
        vec!["-c".to_string(), command.to_string()],
    )
}

fn invocation(command: &str) -> (String, Vec<String>) {
    let (words, compound) = split(command);
    if compound {
        return through_a_shell(command);
    }

    let Some((program, rest)) = words.split_first() else {
        return through_a_shell(command);
    };

    if program.contains('=') {
        return through_a_shell(command);
    }

    (program.clone(), rest.to_vec())
}

#[cfg(test)]
mod tests;
