use std::collections::{BTreeMap, HashMap};
use std::path::Path;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::domain::command::CommandFlags;
use crate::persistence::repositories;
use crate::persistence::repositories::command_groups::{self, CommandGroup, GroupMember};
use crate::persistence::repositories::custom_commands::{self, CustomCommand, PERSONAL_SCOPE};
use crate::support::error::{BackendError, ErrorKind, Result};
use crate::support::now_ms;

pub const VERSION: u32 = 1;

/// What a project looks like once it leaves the database. Paths are absolute and
/// flags travel with their command ids, which are stable across rescans.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BundleProject {
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub favorite: Vec<String>,
    #[serde(default)]
    pub hidden: Vec<String>,
    #[serde(default)]
    pub commands: Vec<BundleCommand>,
}

/// A command the user wrote. An empty `cwd` runs it at the project, or at home
/// for a personal one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BundleCommand {
    pub label: String,
    pub command: String,
    #[serde(default)]
    pub cwd: String,
    #[serde(default)]
    pub favorite: bool,
}

/// One command of a group. `project` is the project's path, or absent for a
/// personal command; a detected command goes by its id and a custom one by its
/// name and what it runs, since ids differ from one database to the next.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BundleMember {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom: Option<CustomRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomRef {
    pub label: String,
    pub command: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BundleGroup {
    pub label: String,
    pub members: Vec<BundleMember>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Bundle {
    pub version: u32,
    pub projects: Vec<BundleProject>,
    #[serde(default)]
    pub personal: Vec<BundleCommand>,
    #[serde(default)]
    pub groups: Vec<BundleGroup>,
}

/// What an import added; anything already there is not counted.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct Imported {
    pub projects: usize,
    pub commands: usize,
    pub groups: usize,
}

pub fn export(conn: &Connection) -> Result<Bundle> {
    let projects = repositories::projects::list(conn)?;
    let customs = custom_commands::list(conn)?;
    let mut bundle = Vec::with_capacity(projects.len());

    for project in &projects {
        let flags = repositories::flags::for_project(conn, project.id)?;

        bundle.push(BundleProject {
            name: project.name.clone(),
            path: project.path.clone(),
            favorite: keys_where(&flags, |flags| flags.favorite),
            hidden: keys_where(&flags, |flags| flags.hidden),
            commands: customs
                .iter()
                .filter(|custom| custom.project_id == Some(project.id))
                .map(|custom| bundle_command(custom, Some(&project.path)))
                .collect(),
        });
    }

    let paths: HashMap<i64, &str> = projects
        .iter()
        .map(|project| (project.id, project.path.as_str()))
        .collect();
    let groups = command_groups::list(conn)?
        .into_iter()
        .map(|group| BundleGroup {
            label: group.label,
            members: group
                .members
                .iter()
                .filter_map(|member| bundle_member(member, &paths, &customs))
                .collect(),
        })
        .filter(|group| !group.members.is_empty())
        .collect();

    Ok(Bundle {
        version: VERSION,
        projects: bundle,
        personal: customs
            .iter()
            .filter(|custom| custom.project_id.is_none())
            .map(|custom| bundle_command(custom, None))
            .collect(),
        groups,
    })
}

fn bundle_command(custom: &CustomCommand, project_path: Option<&str>) -> BundleCommand {
    BundleCommand {
        label: custom.label.clone(),
        command: custom.command.clone(),
        cwd: if project_path == Some(custom.cwd.as_str()) {
            String::new()
        } else {
            custom.cwd.clone()
        },
        favorite: custom.favorite,
    }
}

fn bundle_member(
    member: &GroupMember,
    paths: &HashMap<i64, &str>,
    customs: &[CustomCommand],
) -> Option<BundleMember> {
    let project = if member.project_id == PERSONAL_SCOPE {
        None
    } else {
        Some(paths.get(&member.project_id)?.to_string())
    };

    if let Some(id) = member.command_id.strip_prefix("custom:") {
        let id: i64 = id.parse().ok()?;
        let custom = customs.iter().find(|custom| custom.id == Some(id))?;
        return Some(BundleMember {
            project,
            command: None,
            custom: Some(CustomRef {
                label: custom.label.clone(),
                command: custom.command.clone(),
            }),
        });
    }

    Some(BundleMember {
        project,
        command: Some(member.command_id.clone()),
        custom: None,
    })
}

fn keys_where(
    flags: &repositories::flags::FlagsByCommand,
    wanted: impl Fn(&CommandFlags) -> bool,
) -> Vec<String> {
    flags
        .iter()
        .filter(|(_, flags)| wanted(flags))
        .map(|(command_id, _)| command_id.clone())
        .collect()
}

/// Adds what is missing and leaves what is already there alone, so importing the
/// same file twice cannot duplicate anything. A custom command that is already
/// there is one with the same name and command line; a group, one with the same name.
pub fn import(conn: &Connection, bundle: &Bundle, home: &Path) -> Result<Imported> {
    if bundle.version != VERSION {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            format!(
                "That file is version {} and Pulso reads version {VERSION}.",
                bundle.version
            ),
        ));
    }

    let transaction = conn
        .unchecked_transaction()
        .map_err(crate::persistence::storage_error)?;
    let conn = &transaction;
    let mut imported = Imported::default();
    let mut scopes: HashMap<&str, i64> = HashMap::new();

    for project in &bundle.projects {
        let path = project.path.trim();
        if path.is_empty() || Path::new(path).is_relative() {
            continue;
        }

        let stored = std::fs::canonicalize(path)
            .map(|canonical| canonical.to_string_lossy().into_owned())
            .unwrap_or_else(|_| path.to_string());

        let row = repositories::projects::ensure(conn, &stored, &project.name, now_ms())?;
        imported.projects += conn.changes() as usize;
        scopes.insert(path, row.id);

        let mut wanted: BTreeMap<String, CommandFlags> = BTreeMap::new();
        for command_id in &project.favorite {
            wanted.entry(command_id.clone()).or_default().favorite = true;
        }
        for command_id in &project.hidden {
            wanted.entry(command_id.clone()).or_default().hidden = true;
        }

        let existing = repositories::flags::for_project(conn, row.id)?;

        for (command_id, flags) in wanted {
            if command_id.trim().is_empty() {
                continue;
            }

            let current = existing.get(&command_id).copied().unwrap_or_default();
            repositories::flags::set(
                conn,
                row.id,
                &command_id,
                CommandFlags {
                    favorite: current.favorite || flags.favorite,
                    hidden: current.hidden || flags.hidden,
                },
            )?;
        }

        for command in &project.commands {
            imported.commands += add_custom(conn, Some(row.id), &stored, command, home)?;
        }
    }

    let home_path = home.to_string_lossy();
    for command in &bundle.personal {
        imported.commands += add_custom(conn, None, &home_path, command, home)?;
    }

    let customs = custom_commands::list(conn)?;
    let mut existing: Vec<String> = command_groups::list(conn)?
        .into_iter()
        .map(|group| group.label)
        .collect();

    for group in &bundle.groups {
        let mut members: Vec<GroupMember> = group
            .members
            .iter()
            .filter_map(|member| group_member(member, &scopes, &customs))
            .collect();
        members.truncate(command_groups::MAX_MEMBERS);

        let Ok(group) = command_groups::normalized(CommandGroup {
            id: None,
            label: group.label.clone(),
            members,
        }) else {
            continue;
        };
        if existing.contains(&group.label) {
            continue;
        }

        command_groups::write(conn, &group)?;
        existing.push(group.label);
        imported.groups += 1;
    }

    transaction
        .commit()
        .map_err(crate::persistence::storage_error)?;
    Ok(imported)
}

/// `root` is where the command runs when its folder is not on this Mac.
fn add_custom(
    conn: &Connection,
    project_id: Option<i64>,
    root: &str,
    command: &BundleCommand,
    home: &Path,
) -> Result<usize> {
    let label = command.label.trim();
    let line = command.command.trim();
    if label.is_empty() || line.is_empty() || line.contains('\0') {
        return Ok(0);
    }
    if custom_commands::list(conn)?.iter().any(|custom| {
        custom.project_id == project_id && custom.label == label && custom.command == line
    }) {
        return Ok(0);
    }

    let mut custom = CustomCommand {
        id: None,
        project_id,
        label: label.to_string(),
        command: line.to_string(),
        cwd: command.cwd.clone(),
        favorite: command.favorite,
    };
    custom.cwd =
        custom_commands::resolve_cwd(conn, &custom, home).unwrap_or_else(|_| root.to_string());
    custom_commands::save(conn, &custom)?;
    Ok(1)
}

fn group_member(
    member: &BundleMember,
    scopes: &HashMap<&str, i64>,
    customs: &[CustomCommand],
) -> Option<GroupMember> {
    let project_id = match &member.project {
        Some(path) => *scopes.get(path.trim())?,
        None => PERSONAL_SCOPE,
    };

    let command_id = match (&member.custom, &member.command) {
        (Some(wanted), _) => {
            let owner = (project_id != PERSONAL_SCOPE).then_some(project_id);
            let custom = customs.iter().find(|custom| {
                custom.project_id == owner
                    && custom.label == wanted.label.trim()
                    && custom.command == wanted.command.trim()
            })?;
            format!("custom:{}", custom.id?)
        }
        (None, Some(command_id)) if !command_id.trim().is_empty() => command_id.clone(),
        _ => return None,
    };

    Some(GroupMember {
        project_id,
        command_id,
    })
}

#[cfg(test)]
mod tests;
