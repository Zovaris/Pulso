use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPort {
    pub id: String,
    pub port: u16,
    pub url: Option<String>,
}
