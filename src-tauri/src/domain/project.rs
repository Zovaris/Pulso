use serde::Serialize;

/// A folder Soffy watches.
///
/// `id` is a surrogate key and not the path: a folder that gets moved keeps its
/// identity, so the preferences attached to it can follow.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub availability: Availability,
}

/// Resolved on every read rather than stored: a folder can be moved or deleted
/// while Soffy is closed, and a stale "available" is worse than a slow query.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Availability {
    Available,
    Missing,
}
