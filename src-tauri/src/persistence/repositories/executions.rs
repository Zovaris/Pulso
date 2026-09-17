use rusqlite::{params, Connection};

use crate::domain::execution::{Execution, ExecutionState};
use crate::domain::history::HistoryEntry;
use crate::domain::log::{LogLine, LogStream};
use crate::persistence::storage_error;
use crate::support::error::Result;

pub const KEPT_RUNS: usize = 400;
pub const KEPT_LINES: usize = 200;

pub fn record(conn: &Connection, execution: &Execution, tail: &[LogLine]) -> Result<i64> {
    let args = serde_json::to_string(&execution.args).unwrap_or_else(|_| "[]".to_string());
    let transaction = conn.unchecked_transaction().map_err(storage_error)?;

    transaction
        .execute(
            "INSERT INTO executions
                (project_id, command_id, label, program, args, cwd, state, started_at, ended_at, exit_code, detail)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                execution.project_id,
                execution.command_id,
                execution.label,
                execution.program,
                args,
                execution.cwd,
                execution.state.as_str(),
                execution.started_at,
                execution.ended_at,
                execution.exit_code,
                execution.detail,
            ],
        )
        .map_err(storage_error)?;

    let id = transaction.last_insert_rowid();
    let start = tail.len().saturating_sub(KEPT_LINES);

    for line in &tail[start..] {
        transaction
            .execute(
                "INSERT OR REPLACE INTO execution_logs (execution_id, seq, at, stream, text)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    id,
                    line.seq as i64,
                    line.at,
                    line.stream.as_str(),
                    line.text
                ],
            )
            .map_err(storage_error)?;
    }

    prune(&transaction, KEPT_RUNS)?;
    transaction.commit().map_err(storage_error)?;

    Ok(id)
}

pub fn recent(
    conn: &Connection,
    project_id: Option<i64>,
    limit: usize,
) -> Result<Vec<HistoryEntry>> {
    let mut statement = conn
        .prepare(
            "SELECT e.id, e.project_id, e.command_id, e.label, e.program, e.args, e.cwd,
                    e.state, e.started_at, e.ended_at, e.exit_code, e.detail,
                    (SELECT COUNT(*) FROM execution_logs l WHERE l.execution_id = e.id)
               FROM executions e
              WHERE (?1 IS NULL OR e.project_id = ?1)
              ORDER BY e.started_at DESC, e.id DESC
              LIMIT ?2",
        )
        .map_err(storage_error)?;

    let rows = statement
        .query_map(params![project_id, limit.max(1) as i64], |row| {
            let args: String = row.get(5)?;
            let state: String = row.get(7)?;

            Ok(HistoryEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                command_id: row.get(2)?,
                label: row.get(3)?,
                program: row.get(4)?,
                args: serde_json::from_str(&args).unwrap_or_default(),
                cwd: row.get(6)?,
                state: ExecutionState::parse(&state).unwrap_or(ExecutionState::Interrupted),
                started_at: row.get(8)?,
                ended_at: row.get(9)?,
                exit_code: row.get(10)?,
                detail: row.get(11)?,
                lines: row.get::<_, i64>(12)?.max(0) as usize,
            })
        })
        .map_err(storage_error)?;

    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(storage_error)
}

pub fn lines(conn: &Connection, execution_id: i64, limit: usize) -> Result<Vec<LogLine>> {
    let mut statement = conn
        .prepare(
            "SELECT seq, at, stream, text
               FROM execution_logs
              WHERE execution_id = ?1
              ORDER BY seq DESC
              LIMIT ?2",
        )
        .map_err(storage_error)?;

    let rows = statement
        .query_map(params![execution_id, limit.max(1) as i64], |row| {
            let stream: String = row.get(2)?;

            Ok(LogLine {
                seq: row.get::<_, i64>(0)?.max(0) as u64,
                at: row.get(1)?,
                stream: LogStream::parse(&stream).unwrap_or(LogStream::Stdout),
                text: row.get(3)?,
            })
        })
        .map_err(storage_error)?;

    let mut lines = rows
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(storage_error)?;
    lines.reverse();

    Ok(lines)
}

pub fn count(conn: &Connection) -> Result<usize> {
    conn.query_row("SELECT COUNT(*) FROM executions", [], |row| {
        row.get::<_, i64>(0)
    })
    .map(|count| count.max(0) as usize)
    .map_err(storage_error)
}

pub fn clear(conn: &Connection) -> Result<usize> {
    conn.execute("DELETE FROM executions", [])
        .map_err(storage_error)
}

pub fn close_orphans(conn: &Connection, at: i64) -> Result<usize> {
    conn.execute(
        "UPDATE executions
            SET state = 'interrupted', ended_at = ?1
          WHERE ended_at IS NULL",
        params![at],
    )
    .map_err(storage_error)
}

fn prune(conn: &Connection, keep: usize) -> Result<()> {
    conn.execute(
        "DELETE FROM executions
          WHERE id NOT IN (
                SELECT id FROM executions ORDER BY started_at DESC, id DESC LIMIT ?1
          )",
        params![keep as i64],
    )
    .map_err(storage_error)?;

    Ok(())
}

#[cfg(test)]
mod tests;
