use serde::{Deserialize, Serialize};

/// A verified listening TCP socket, not a hint parsed from command output.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPort {
    pub pid: i32,
    pub process: String,
    pub port: u16,
    pub address: String,
    pub started_at: Option<String>,
    pub execution_id: Option<i64>,
    pub can_stop: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortTarget {
    pub pid: i32,
    pub port: u16,
    pub address: String,
    pub started_at: Option<String>,
}

impl ListeningPort {
    pub fn matches(&self, target: &PortTarget) -> bool {
        self.pid == target.pid
            && self.port == target.port
            && self.address == target.address
            && self.started_at == target.started_at
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPort {
    pub id: String,
    pub port: u16,
    pub url: Option<String>,
}
