use serde::Serialize;

use crate::domain::execution::ExecutionState;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub project_id: i64,
    pub command_id: String,
    pub label: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub state: ExecutionState,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub exit_code: Option<i32>,
    pub detail: Option<String>,
    pub lines: usize,
}
