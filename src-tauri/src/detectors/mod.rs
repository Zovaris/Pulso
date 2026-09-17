pub mod composer_json;
pub mod deno_json;
pub mod justfile;
pub mod makefile;
pub mod naming;
pub mod package_json;
pub mod procfile;

use std::path::{Path, PathBuf};

use crate::domain::command::{CommandScan, DetectedCommand, ScanStatus};

#[derive(Debug, Clone)]
pub enum DetectError {
    Missing,
    Unreadable(String),
    Invalid(String),
}

pub trait CommandDetector {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError>;
}

pub fn detectors() -> [&'static dyn CommandDetector; 6] {
    [
        &package_json::PackageJsonDetector,
        &deno_json::DenoJsonDetector,
        &composer_json::ComposerJsonDetector,
        &makefile::MakefileDetector,
        &justfile::JustfileDetector,
        &procfile::ProcfileDetector,
    ]
}

pub fn manifest(project_dir: &Path, names: &[&str]) -> Option<PathBuf> {
    names
        .iter()
        .map(|name| project_dir.join(name))
        .find(|candidate| candidate.is_file())
}

pub fn scan(project_id: i64, project_dir: &Path) -> CommandScan {
    if !project_dir.is_dir() {
        return CommandScan::new(
            project_id,
            ScanStatus::Unavailable,
            Some("The project folder is not there.".to_string()),
        );
    }

    let mut commands: Vec<DetectedCommand> = Vec::new();
    let mut silent: Vec<&str> = Vec::new();
    let mut invalid: Vec<String> = Vec::new();
    let mut unreadable: Vec<String> = Vec::new();

    for detector in detectors() {
        match detector.detect(project_dir) {
            Ok(found) if found.is_empty() => silent.push(detector.label()),
            Ok(found) => commands.extend(found),
            Err(DetectError::Missing) => {}
            Err(DetectError::Invalid(detail)) => invalid.push(detail),
            Err(DetectError::Unreadable(detail)) => unreadable.push(detail),
        }
    }

    if !commands.is_empty() {
        naming::sort_commands(&mut commands);
        return CommandScan::detected(project_id, commands);
    }

    if !invalid.is_empty() {
        return CommandScan::new(
            project_id,
            ScanStatus::InvalidManifest,
            Some(invalid.join(" ")),
        );
    }

    if !unreadable.is_empty() {
        return CommandScan::new(
            project_id,
            ScanStatus::Unreadable,
            Some(unreadable.join(" ")),
        );
    }

    if !silent.is_empty() {
        return CommandScan::new(project_id, ScanStatus::NoCommands, Some(silent.join(", ")));
    }

    let looked_for: Vec<&str> = detectors()
        .iter()
        .map(|detector| detector.label())
        .collect();

    CommandScan::new(
        project_id,
        ScanStatus::NoManifest,
        Some(looked_for.join(", ")),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("tests")
            .join("fixtures")
            .join(name)
    }

    #[test]
    fn commands_from_every_manifest_land_in_one_scan() {
        let scan = scan(1, &fixture("mixed-project"));
        let labels: Vec<&str> = scan
            .commands
            .iter()
            .map(|command| command.label.as_str())
            .collect();

        assert_eq!(scan.status, ScanStatus::Detected);
        assert!(labels.contains(&"dev"));
        assert!(labels.contains(&"migrate"));
        assert!(labels.contains(&"web"));

        let detectors: Vec<&str> = scan
            .commands
            .iter()
            .map(|command| command.detector.as_str())
            .collect();
        assert!(detectors.contains(&"package_json"));
        assert!(detectors.contains(&"makefile"));
        assert!(detectors.contains(&"procfile"));
    }

    #[test]
    fn the_whole_scan_keeps_the_running_commands_first() {
        let scan = scan(1, &fixture("mixed-project"));
        let ranks: Vec<u8> = scan
            .commands
            .iter()
            .map(|command| command.category.rank())
            .collect();

        assert!(ranks.windows(2).all(|pair| pair[0] <= pair[1]));
    }

    #[test]
    fn a_folder_with_nothing_to_read_names_what_soffy_looks_for() {
        let scan = scan(2, &fixture("empty-project"));

        assert_eq!(scan.status, ScanStatus::NoManifest);
        assert!(scan.commands.is_empty());
        let detail = scan.detail.unwrap_or_default();
        for manifest in [
            "package.json",
            "Makefile",
            "justfile",
            "Procfile",
            "composer.json",
        ] {
            assert!(
                detail.contains(manifest),
                "{manifest} should be listed in {detail}"
            );
        }
    }

    #[test]
    fn manifests_that_declare_nothing_are_named() {
        let scan = scan(2, &fixture("bare-project"));

        assert_eq!(scan.status, ScanStatus::NoCommands);
        let detail = scan.detail.unwrap_or_default();
        assert_eq!(detail, "package.json, deno.json, composer.json");
    }

    #[test]
    fn a_broken_manifest_is_reported_even_when_another_one_works() {
        let scan = scan(2, &fixture("half-broken-project"));

        assert_eq!(scan.status, ScanStatus::Detected);
        assert!(!scan.commands.is_empty());
    }

    #[test]
    fn a_folder_that_is_gone_is_unavailable() {
        let scan = scan(1, Path::new("/soffy/does/not/exist"));

        assert_eq!(scan.status, ScanStatus::Unavailable);
    }
}
