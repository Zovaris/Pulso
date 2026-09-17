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
        JustfileDetector
            .detect(&fixture(name))
            .unwrap_or_else(|error| panic!("{name} should detect: {error:?}"))
    }

    fn labels(name: &str) -> Vec<String> {
        detect(name)
            .into_iter()
            .map(|command| command.label)
            .collect()
    }

    #[test]
    fn every_runnable_recipe_becomes_a_command() {
        let labels = labels("just-project");

        for recipe in ["dev", "build", "test", "test-all"] {
            assert!(
                labels.contains(&recipe.to_string()),
                "{recipe} should be detected"
            );
        }
    }

    #[test]
    fn a_recipe_runs_through_just() {
        let commands = detect("just-project");
        let dev = commands
            .iter()
            .find(|command| command.label == "dev")
            .expect("dev should be detected");

        assert_eq!(dev.id, "justfile:dev");
        assert_eq!(dev.detector, "justfile");
        assert_eq!(dev.program, "just");
        assert_eq!(dev.args, vec!["dev".to_string()]);
        assert!(dev.source.ends_with("justfile"));
        assert_eq!(dev.category, CommandCategory::Dev);
        assert!(dev.long_running);
    }

    #[test]
    fn private_recipes_stay_private() {
        assert!(!labels("just-project").contains(&"_deploy".to_string()));
    }

    #[test]
    fn a_recipe_that_needs_an_argument_is_left_out() {
        assert!(!labels("just-project").contains(&"release".to_string()));
        assert!(!labels("just-project").contains(&"promote".to_string()));
    }

    #[test]
    fn settings_aliases_and_assignments_are_not_recipes() {
        let contents = "\
set shell := [\"bash\", \"-c\"]
alias b := build
export TOKEN := \"secret\"
mod shared
import 'other.just'
include other.just
dev:
	just --list
";

        assert_eq!(recipes(contents), vec!["dev"]);
    }

    #[test]
    fn a_parameter_with_a_default_still_runs_bare() {
        assert_eq!(recipes("test filter=\"\":\n\tbun test\n"), vec!["test"]);
        assert_eq!(recipes("test-all *args:\n\tbun test\n"), vec!["test-all"]);
        assert!(recipes("run second:\n\tbin\n").is_empty());
    }

    #[test]
    fn the_project_folder_says_which_it_is() {
        let missing = JustfileDetector.detect(&fixture("empty-project"));
        assert!(matches!(missing, Err(DetectError::Missing)));

        let scan = scan(4, &fixture("just-project"));
        assert_eq!(scan.status, ScanStatus::Detected);
    }
}
