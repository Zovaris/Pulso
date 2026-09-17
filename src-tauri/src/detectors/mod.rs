pub mod cargo_toml;
pub mod compose;
pub mod composer_json;
pub mod deno_json;
pub mod justfile;
pub mod makefile;
pub mod naming;
pub mod package_json;
pub mod procfile;
pub mod taskfile;

use std::path::{Path, PathBuf};

use yaml_rust2::Yaml;

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

pub fn detectors() -> [&'static dyn CommandDetector; 9] {
    [
        &package_json::PackageJsonDetector,
        &deno_json::DenoJsonDetector,
        &composer_json::ComposerJsonDetector,
        &makefile::MakefileDetector,
        &justfile::JustfileDetector,
        &taskfile::TaskfileDetector,
        &compose::ComposeDetector,
        &cargo_toml::CargoTomlDetector,
        &procfile::ProcfileDetector,
    ]
}

pub fn manifest(project_dir: &Path, names: &[&str]) -> Option<PathBuf> {
    names
        .iter()
        .map(|name| project_dir.join(name))
        .find(|candidate| candidate.is_file())
}

pub fn declared_keys<'a>(document: &'a [Yaml], key: &str) -> Vec<&'a str> {
    let Some(section) = document.first().and_then(|root| root[key].as_hash()) else {
        return Vec::new();
    };

    section
        .keys()
        .filter_map(Yaml::as_str)
        .filter(|name| !name.starts_with('_'))
        .collect()
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
mod tests;
