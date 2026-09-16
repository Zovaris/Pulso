use serde::Serialize;

/// Everything needed to run a command later.
///
/// Program and arguments stay separate on purpose: nothing read from a manifest
/// is ever concatenated into a shell line, so a script name cannot turn into a
/// second command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedCommand {
    /// Stable across scans: `<detector>:<label>`.
    pub id: String,
    pub label: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub source: String,
    pub detector: String,
    pub category: CommandCategory,
    pub long_running: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CommandCategory {
    Dev,
    Build,
    Test,
    Lint,
    Database,
    Infrastructure,
    Other,
}

impl CommandCategory {
    /// Display order. The commands reached for many times a day come first, the
    /// one-shot build steps last.
    pub fn rank(self) -> u8 {
        match self {
            Self::Dev => 0,
            Self::Database => 1,
            Self::Test => 2,
            Self::Lint => 3,
            Self::Build => 4,
            Self::Infrastructure => 5,
            Self::Other => 6,
        }
    }
}

/// What one scan of a project found, including why it found nothing. The UI
/// renders an honest empty state from `status` instead of guessing, and only
/// shows `detail` when the reason is technical.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandScan {
    pub project_id: i64,
    pub commands: Vec<DetectedCommand>,
    pub status: ScanStatus,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ScanStatus {
    /// Commands were found.
    Detected,
    /// No manifest Soffy reads is present.
    NoManifest,
    /// The manifest is there and declares nothing.
    NoCommands,
    /// The manifest is there and could not be parsed.
    InvalidManifest,
    /// The manifest could not be read as a file.
    Unreadable,
    /// The project folder itself is gone.
    Unavailable,
}

impl CommandScan {
    pub fn new(project_id: i64, status: ScanStatus, detail: Option<String>) -> Self {
        Self {
            project_id,
            commands: Vec::new(),
            status,
            detail,
        }
    }

    pub fn detected(project_id: i64, commands: Vec<DetectedCommand>) -> Self {
        Self {
            project_id,
            commands,
            status: ScanStatus::Detected,
            detail: None,
        }
    }
}
