pub mod package_json;

use std::path::Path;

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

pub fn scan(project_id: i64, project_dir: &Path) -> CommandScan {
    if !project_dir.is_dir() {
        return CommandScan::new(
            project_id,
            ScanStatus::Unavailable,
            Some("The project folder is not there.".to_string()),
        );
    }

    let detector = package_json::PackageJsonDetector;

    match detector.detect(project_dir) {
        Ok(commands) if commands.is_empty() => CommandScan::new(
            project_id,
            ScanStatus::NoCommands,
            Some(format!("{} declares no scripts.", detector.label())),
        ),
        Ok(commands) => CommandScan::detected(project_id, commands),
        Err(DetectError::Missing) => CommandScan::new(
            project_id,
            ScanStatus::NoManifest,
            Some(format!("{} is not in this folder.", detector.label())),
        ),
        Err(DetectError::Invalid(detail)) => {
            CommandScan::new(project_id, ScanStatus::InvalidManifest, Some(detail))
        }
        Err(DetectError::Unreadable(detail)) => {
            CommandScan::new(project_id, ScanStatus::Unreadable, Some(detail))
        }
    }
}
