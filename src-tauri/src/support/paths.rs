use std::path::{Path, PathBuf};

use super::error::{BackendError, ErrorKind, Result};

/// Canonical path for a folder the user picked. Symlinks and trailing slashes
/// are resolved, so the same folder always resolves to the same project no
/// matter how it was reached.
pub fn canonical_dir(path: &Path) -> Result<PathBuf> {
    if !path.exists() {
        return Err(BackendError::at(
            ErrorKind::NotFound,
            path,
            "That folder is not there.",
        ));
    }
    if !path.is_dir() {
        return Err(BackendError::at(
            ErrorKind::NotADirectory,
            path,
            "That is a file, not a folder.",
        ));
    }

    std::fs::canonicalize(path).map_err(|error| {
        BackendError::at(
            ErrorKind::Unreadable,
            path,
            format!("The folder could not be read: {error}"),
        )
    })
}

pub fn as_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// The folder name, which is what a person recognizes in a list.
pub fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| as_string(path))
}

pub fn is_available(path: &str) -> bool {
    Path::new(path).is_dir()
}
