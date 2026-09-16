use std::fmt;
use std::path::Path;

use serde::Serialize;

/// Every failure a command can return. `kind` is what the UI localizes against;
/// `message` is the technical detail, safe to show as a fallback and as the
/// second line of an error state.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendError {
    pub kind: ErrorKind,
    pub message: String,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    /// The thing being acted on is not where it was.
    NotFound,
    /// A folder was expected and a file was picked.
    NotADirectory,
    /// The path exists but cannot be read.
    Unreadable,
    /// A value from the frontend is not one the backend accepts.
    InvalidInput,
    /// SQLite refused an operation.
    Storage,
    /// A task did not finish. Always worth reporting, never worth guessing at.
    Internal,
}

impl BackendError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            path: None,
        }
    }

    pub fn at(kind: ErrorKind, path: &Path, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            path: Some(path.to_string_lossy().into_owned()),
        }
    }

    pub fn storage(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Storage, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorKind::Internal, message)
    }
}

impl fmt::Display for BackendError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.path {
            Some(path) => write!(formatter, "{} ({path})", self.message),
            None => formatter.write_str(&self.message),
        }
    }
}

impl std::error::Error for BackendError {}

pub type Result<T> = std::result::Result<T, BackendError>;
