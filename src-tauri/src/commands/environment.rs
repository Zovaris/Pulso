use std::path::Path;
use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::persistence::{repositories, Database};
use crate::platform::macos::environment::which;
use crate::process::supervisor::ProcessSupervisor;
use crate::support::error::{BackendError, ErrorKind, Result};

use super::{in_database, off_thread};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathEntry {
    pub dir: String,
    pub exists: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramLookup {
    pub name: String,
    pub path: Option<String>,
}

/// What a command would actually run with: the shell Pulso asked, the `PATH` it
/// got back, and where each program it needs really resolves. This is the answer
/// to "command not found" without guessing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentReport {
    pub shell: String,
    pub path: String,
    pub entries: Vec<PathEntry>,
    pub programs: Vec<ProgramLookup>,
}

pub fn report(shell: String, path: String, programs: &[String]) -> EnvironmentReport {
    let entries = path
        .split(':')
        .filter(|dir| !dir.is_empty())
        .map(|dir| PathEntry {
            dir: dir.to_string(),
            exists: Path::new(dir).is_dir(),
        })
        .collect();

    let programs = programs
        .iter()
        .map(|name| ProgramLookup {
            name: name.clone(),
            path: which(name, &path),
        })
        .collect();

    EnvironmentReport {
        shell,
        path,
        entries,
        programs,
    }
}

#[cfg(test)]
mod tests;

#[tauri::command]
pub async fn environment_report(
    db: State<'_, Arc<Database>>,
    supervisor: State<'_, Arc<ProcessSupervisor>>,
    project_id: i64,
) -> Result<EnvironmentReport> {
    let project = in_database(&db, move |conn| {
        repositories::projects::by_id(conn, project_id)
    })
    .await?
    .ok_or_else(|| BackendError::new(ErrorKind::NotFound, "That project is no longer in Pulso."))?;

    let folder = project.path.clone();
    let scan = off_thread(move || crate::detectors::scan(project_id, Path::new(&folder))).await?;

    let mut programs: Vec<String> = scan
        .commands
        .iter()
        .map(|command| command.program.clone())
        .collect();
    programs.sort();
    programs.dedup();

    let reader = Arc::clone(supervisor.inner());
    let environment = off_thread(move || reader.environment(Path::new(&project.path))).await?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let path = environment.get("PATH").cloned().unwrap_or_default();

    Ok(report(shell, path, &programs))
}
