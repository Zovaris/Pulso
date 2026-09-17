use serde::Serialize;

/// What one live execution is costing right now.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricSample {
    pub execution_id: i64,
    /// Percent of a single core, summed across the process group, so a busy
    /// group can read above 100. The UI formats it, it does not clamp it.
    pub cpu: f32,
    /// Resident memory of the whole group, in bytes.
    pub memory: u64,
    pub processes: usize,
}
