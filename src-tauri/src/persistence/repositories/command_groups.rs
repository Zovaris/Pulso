use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::persistence::storage_error;
use crate::support::error::{BackendError, ErrorKind, Result};

/// The most commands one group starts at once.
pub const MAX_MEMBERS: usize = 24;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMember {
    pub project_id: i64,
    pub command_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandGroup {
    pub id: Option<i64>,
    pub label: String,
    pub members: Vec<GroupMember>,
}

/// Trims the name and drops repeated members, keeping the first position of each.
pub fn normalized(mut group: CommandGroup) -> Result<CommandGroup> {
    group.label = group.label.trim().into();
    let mut seen = std::collections::HashSet::new();
    group
        .members
        .retain(|member| seen.insert((member.project_id, member.command_id.clone())));
    if group.label.is_empty() {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "Give the group a name.",
        ));
    }
    if group.members.is_empty() || group.members.len() > MAX_MEMBERS {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "A group needs between 1 and 24 commands.",
        ));
    }
    if group
        .members
        .iter()
        .any(|member| member.command_id.trim().is_empty() || member.project_id < 0)
    {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "One of the commands in this group is not valid.",
        ));
    }
    Ok(group)
}

pub fn list(conn: &Connection) -> Result<Vec<CommandGroup>> {
    let mut groups: Vec<CommandGroup> = conn
        .prepare("SELECT id, label FROM command_groups ORDER BY id")
        .map_err(storage_error)?
        .query_map([], |row| {
            Ok(CommandGroup {
                id: row.get(0)?,
                label: row.get(1)?,
                members: Vec::new(),
            })
        })
        .map_err(storage_error)?
        .collect::<std::result::Result<_, _>>()
        .map_err(storage_error)?;

    let mut members = conn
        .prepare(
            "SELECT group_id, project_id, command_id FROM command_group_members ORDER BY group_id, position",
        )
        .map_err(storage_error)?;
    let rows = members
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                GroupMember {
                    project_id: row.get(1)?,
                    command_id: row.get(2)?,
                },
            ))
        })
        .map_err(storage_error)?;
    for row in rows {
        let (group_id, member) = row.map_err(storage_error)?;
        if let Some(group) = groups.iter_mut().find(|group| group.id == Some(group_id)) {
            group.members.push(member);
        }
    }
    Ok(groups)
}

pub fn save(conn: &Connection, group: &CommandGroup) -> Result<()> {
    let tx = conn.unchecked_transaction().map_err(storage_error)?;
    write(&tx, group)?;
    tx.commit().map_err(storage_error)
}

/// Saves a group inside a transaction the caller already holds.
pub fn write(tx: &Connection, group: &CommandGroup) -> Result<()> {
    let id = match group.id {
        Some(id) => {
            let changed = tx
                .execute(
                    "UPDATE command_groups SET label = ?2 WHERE id = ?1",
                    params![id, group.label],
                )
                .map_err(storage_error)?;
            if changed == 0 {
                return Err(BackendError::new(
                    ErrorKind::NotFound,
                    "That group is no longer in Pulso.",
                ));
            }
            tx.execute(
                "DELETE FROM command_group_members WHERE group_id = ?1",
                [id],
            )
            .map_err(storage_error)?;
            id
        }
        None => {
            tx.execute(
                "INSERT INTO command_groups (label) VALUES (?1)",
                [&group.label],
            )
            .map_err(storage_error)?;
            tx.last_insert_rowid()
        }
    };
    for (position, member) in group.members.iter().enumerate() {
        tx.execute(
            "INSERT INTO command_group_members (group_id, position, project_id, command_id) VALUES (?1, ?2, ?3, ?4)",
            params![id, position as i64, member.project_id, member.command_id],
        )
        .map_err(storage_error)?;
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    if conn
        .execute("DELETE FROM command_groups WHERE id = ?1", [id])
        .map_err(storage_error)?
        == 0
    {
        return Err(BackendError::new(
            ErrorKind::NotFound,
            "That group is no longer in Pulso.",
        ));
    }
    Ok(())
}
