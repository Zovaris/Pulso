use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedCommand {
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
    Detected,
    NoManifest,
    NoCommands,
    InvalidManifest,
    Unreadable,
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
