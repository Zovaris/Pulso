use std::sync::Arc;

use tauri::State;

use crate::domain::history::HistoryEntry;
use crate::domain::log::LogSnapshot;
use crate::persistence::repositories;
use crate::persistence::Database;
use crate::support::error::Result;

use super::in_database;

const RECENT: usize = 30;
const CEILING: usize = 400;

#[tauri::command]
pub async fn list_execution_history(
    db: State<'_, Arc<Database>>,
    project_id: Option<i64>,
    limit: Option<usize>,
) -> Result<Vec<HistoryEntry>> {
    let limit = limit.unwrap_or(RECENT).clamp(1, CEILING);

    in_database(&db, move |conn| {
        repositories::executions::recent(conn, project_id, limit)
    })
    .await
}

#[tauri::command]
pub async fn read_execution_log(
    db: State<'_, Arc<Database>>,
    execution_id: i64,
    limit: Option<usize>,
) -> Result<LogSnapshot> {
    let limit = limit
        .unwrap_or(repositories::executions::KEPT_LINES)
        .clamp(1, repositories::executions::KEPT_LINES);

    let lines = in_database(&db, move |conn| {
        repositories::executions::lines(conn, execution_id, limit)
    })
    .await?;

    Ok(LogSnapshot {
        execution_id,
        lines,
    })
}

#[tauri::command]
pub async fn clear_execution_history(db: State<'_, Arc<Database>>) -> Result<usize> {
    in_database(&db, repositories::executions::clear).await
}
