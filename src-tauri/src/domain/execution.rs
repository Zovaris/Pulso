use serde::Serialize;

use crate::domain::command::DetectedCommand;
use crate::domain::port::DetectedPort;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Execution {
    pub id: i64,
    pub project_id: i64,
    pub command_id: String,
    pub label: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub state: ExecutionState,
    pub pid: Option<u32>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub exit_code: Option<i32>,
    pub detail: Option<String>,
    pub restarted_from: Option<i64>,
    pub ports: Vec<DetectedPort>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ExecutionState {
    Starting,
    Running,
    Stopping,
    Exited,
    Failed,
}

impl ExecutionState {
    pub fn is_active(self) -> bool {
        matches!(self, Self::Starting | Self::Running | Self::Stopping)
    }
}

impl Execution {
    pub fn new(id: i64, project_id: i64, command: &DetectedCommand, started_at: i64) -> Self {
        Self {
            id,
            project_id,
            command_id: command.id.clone(),
            label: command.label.clone(),
            program: command.program.clone(),
            args: command.args.clone(),
            cwd: command.cwd.clone(),
            state: ExecutionState::Starting,
            pid: None,
            started_at,
            ended_at: None,
            exit_code: None,
            detail: None,
            restarted_from: None,
            ports: Vec::new(),
        }
    }

    pub fn is_active(&self) -> bool {
        self.state.is_active()
    }
}
