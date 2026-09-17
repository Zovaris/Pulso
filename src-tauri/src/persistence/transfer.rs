use std::collections::BTreeMap;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::domain::command::CommandFlags;
use crate::persistence::repositories;
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Bundle {
    pub version: u32,
    pub projects: Vec<BundleProject>,
}

pub fn export(conn: &Connection) -> Result<Bundle> {
    let projects = repositories::projects::list(conn)?;
    let mut bundle = Vec::with_capacity(projects.len());

    for project in projects {
        let flags = repositories::flags::for_project(conn, project.id)?;

        bundle.push(BundleProject {
            name: project.name,
            path: project.path,
            favorite: keys_where(&flags, |flags| flags.favorite),
            hidden: keys_where(&flags, |flags| flags.hidden),
        });
    }

    Ok(Bundle {
        version: VERSION,
        projects: bundle,
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
/// same file twice cannot duplicate anything.
pub fn import(conn: &Connection, bundle: &Bundle) -> Result<usize> {
    if bundle.version != VERSION {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            format!(
                "That file is version {} and Pulso reads version {VERSION}.",
                bundle.version
            ),
        ));
    }

    let mut added = 0;

    for project in &bundle.projects {
        let path = project.path.trim();
        if path.is_empty() {
            continue;
        }

        let row = repositories::projects::ensure(conn, path, &project.name, now_ms())?;
        added += 1;

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
    }

    Ok(added)
}

#[cfg(test)]
mod tests;
