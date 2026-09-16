pub mod package_json;

use std::path::Path;

use crate::domain::command::{CommandScan, DetectedCommand, ScanStatus};

/// Why a detector could not produce commands. The distinction matters to the
/// UI: "there is nothing here yet" and "this file is broken" are different
/// messages.
#[derive(Debug, Clone)]
pub enum DetectError {
    /// The manifest this detector reads is not in the project.
    Missing,
    /// The manifest is there but could not be read as a file.
    Unreadable(String),
    /// The manifest is readable but not valid.
    Invalid(String),
}

/// The contract every detector implements. `plan.md` fixes this shape so that a
/// second manifest type is one module, not a second code path.
pub trait CommandDetector {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError>;
}

/// Runs the detectors that exist today and folds the outcome into one scan.
///
/// Detection always reads the project instead of a stored copy, so a manifest
/// edited outside Soffy is correct on the next scan with no invalidation step.
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
