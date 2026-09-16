pub mod database;
pub mod repositories;

pub use database::Database;

use crate::support::error::BackendError;

/// One place where a SQLite failure becomes a backend error, so no repository
/// has to invent its own wording.
pub fn storage_error(error: rusqlite::Error) -> BackendError {
    BackendError::storage(format!("The database refused the operation: {error}"))
}
