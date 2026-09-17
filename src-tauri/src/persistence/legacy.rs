use std::path::{Path, PathBuf};

use crate::support::error::{BackendError, ErrorKind, Result};

const LEGACY_BUNDLE_ID: &str = "com.sthbryan.soffy";
const LEGACY_DATABASE: &str = "soffy.db";
const DATABASE: &str = "pulso.db";

pub fn database_path(data_dir: &Path) -> PathBuf {
    data_dir.join(DATABASE)
}

pub fn adopt_legacy_database(data_dir: &Path) -> Result<()> {
    let current = database_path(data_dir);
    if current.exists() {
        return Ok(());
    }

    let Some(parent) = data_dir.parent() else {
        return Ok(());
    };
    let legacy = parent.join(LEGACY_BUNDLE_ID).join(LEGACY_DATABASE);
    if !legacy.is_file() {
        return Ok(());
    }

    std::fs::create_dir_all(data_dir).map_err(|error| {
        BackendError::at(
            ErrorKind::Storage,
            data_dir,
            format!("The data folder could not be created: {error}"),
        )
    })?;

    for suffix in ["", "-wal", "-shm"] {
        let from = with_suffix(&legacy, suffix);
        if from.is_file() {
            let to = with_suffix(&current, suffix);
            std::fs::copy(&from, &to).map_err(|error| {
                BackendError::at(
                    ErrorKind::Storage,
                    &from,
                    format!("The previous database could not be carried over: {error}"),
                )
            })?;
        }
    }

    Ok(())
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    if suffix.is_empty() {
        return path.to_path_buf();
    }

    let mut raw = path.as_os_str().to_os_string();
    raw.push(suffix);
    PathBuf::from(raw)
}

#[cfg(test)]
mod tests;
