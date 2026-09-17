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
mod tests {
    use super::*;
    use crate::detectors::scan;
    use crate::domain::command::ScanStatus;

    fn fixture(name: &str) -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("fixtures")
            .join(name)
    }

    fn detect(name: &str) -> Vec<DetectedCommand> {
        DenoJsonDetector
            .detect(&fixture(name))
            .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
    }

    #[test]
    fn every_task_becomes_a_deno_command() {
        let commands = detect("deno-project");
        let dev = commands
            .iter()
            .find(|command| command.label == "dev")
            .expect("dev should be detected");

        assert_eq!(dev.id, "deno_json:dev");
        assert_eq!(dev.program, "deno");
        assert_eq!(dev.args, vec!["task".to_string(), "dev".to_string()]);
        assert!(dev.long_running);
    }

    #[test]
    fn the_commented_flavour_parses_too() {
        let commands = detect("deno-project");
        let labels: Vec<&str> = commands.iter().map(|c| c.label.as_str()).collect();

        assert!(labels.contains(&"check"));
    }

    #[test]
    fn comments_go_away_and_strings_are_left_alone() {
        let raw = "{\n  // a line comment\n  \"imports\": {\n    \"x\": \"https://esm.sh/x\" /* block */\n  },\n  \"scoped\": \"soffy://with//slashes\"\n}\n";

        let clean = without_comments(raw);
        let value: Value = serde_json::from_str(&clean).expect("the cleaned text should parse");

        assert_eq!(value["imports"]["x"], "https://esm.sh/x");
        assert_eq!(value["scoped"], "soffy://with//slashes");
    }

    #[test]
    fn an_escape_inside_a_string_does_not_end_it() {
        let clean = without_comments("{\"a\": \"one \\\" // two\"}");

        assert_eq!(clean, "{\"a\": \"one \\\" // two\"}");
    }

    #[test]
    fn a_manifest_without_tasks_declares_nothing() {
        assert!(detect("bare-project").is_empty());
    }

    #[test]
    fn the_project_folder_says_which_it_is() {
        let missing = DenoJsonDetector.detect(&fixture("empty-project"));
        assert!(matches!(missing, Err(DetectError::Missing)));

        let scan = scan(8, &fixture("deno-project"));
        assert_eq!(scan.status, ScanStatus::Detected);
    }
}
