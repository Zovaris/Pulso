use std::collections::BTreeMap;

use rusqlite::{params, Connection};

use crate::domain::command::CommandFlags;
use crate::persistence::storage_error;
use crate::support::error::Result;

pub type FlagsByCommand = BTreeMap<String, CommandFlags>;

pub fn for_project(conn: &Connection, project_id: i64) -> Result<FlagsByCommand> {
    let mut statement = conn
        .prepare(
            "SELECT command_id, favorite, hidden
               FROM command_flags
              WHERE project_id = ?1
                AND (favorite = 1 OR hidden = 1)",
        )
        .map_err(storage_error)?;

    let rows = statement
        .query_map(params![project_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                CommandFlags {
                    favorite: row.get::<_, i64>(1)? != 0,
                    hidden: row.get::<_, i64>(2)? != 0,
                },
            ))
        })
        .map_err(storage_error)?
        .collect::<std::result::Result<BTreeMap<_, _>, _>>()
        .map_err(storage_error)?;

    Ok(rows)
}

pub fn set(
    conn: &Connection,
    project_id: i64,
    command_id: &str,
    flags: CommandFlags,
) -> Result<()> {
    if !flags.favorite && !flags.hidden {
        conn.execute(
            "DELETE FROM command_flags WHERE project_id = ?1 AND command_id = ?2",
            params![project_id, command_id],
        )
        .map_err(storage_error)?;

        return Ok(());
    }

    conn.execute(
        "INSERT INTO command_flags (project_id, command_id, favorite, hidden)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id, command_id)
         DO UPDATE SET favorite = excluded.favorite, hidden = excluded.hidden",
        params![
            project_id,
            command_id,
            i64::from(flags.favorite),
            i64::from(flags.hidden)
        ],
    )
    .map_err(storage_error)?;

    Ok(())
}

#[cfg(test)]
mod tests;
