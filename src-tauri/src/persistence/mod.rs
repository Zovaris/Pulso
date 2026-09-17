pub mod database;
pub mod repositories;

pub use database::Database;

use crate::support::error::BackendError;

pub fn storage_error(error: rusqlite::Error) -> BackendError {
    BackendError::storage(format!("The database refused the operation: {error}"))
}
