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
mod tests {
    use super::*;
    use crate::detectors::scan;
    use crate::domain::command::{CommandCategory, ScanStatus};

    fn fixture(name: &str) -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("fixtures")
            .join(name)
    }

    fn detect(name: &str) -> Vec<DetectedCommand> {
        ComposerJsonDetector
            .detect(&fixture(name))
            .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
    }

    fn command<'a>(commands: &'a [DetectedCommand], label: &str) -> &'a DetectedCommand {
        commands
            .iter()
            .find(|command| command.label == label)
            .unwrap_or_else(|| panic!("{label} should be detected"))
    }

    #[test]
    fn every_script_becomes_a_composer_command() {
        let commands = detect("php-project");

        let test = command(&commands, "test");
        assert_eq!(test.id, "composer_json:test");
        assert_eq!(test.program, "composer");
        assert_eq!(
            test.args,
            vec!["run-script".to_string(), "test".to_string()]
        );
        assert_eq!(test.category, CommandCategory::Test);
        assert!(test.source.ends_with("composer.json"));
    }

    #[test]
    fn a_script_that_is_a_list_of_steps_still_counts() {
        let commands = detect("php-project");

        assert_eq!(command(&commands, "checks").args[1], "checks");
    }

    #[test]
    fn a_manifest_without_scripts_declares_nothing() {
        assert!(detect("bare-project").is_empty());
    }

    #[test]
    fn a_broken_manifest_is_reported_as_invalid() {
        let broken = ComposerJsonDetector.detect(&fixture("broken-project"));
        assert!(matches!(broken, Err(DetectError::Missing)));
    }

    #[test]
    fn the_project_folder_says_which_it_is() {
        let missing = ComposerJsonDetector.detect(&fixture("empty-project"));
        assert!(matches!(missing, Err(DetectError::Missing)));

        let scan = scan(6, &fixture("php-project"));
        assert_eq!(scan.status, ScanStatus::Detected);
    }
}
