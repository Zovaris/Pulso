use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::app::picker;
use crate::commands::settings;
use crate::events;
use crate::persistence::{repositories, transfer, Database};
use crate::support::archive;
use crate::support::error::{BackendError, ErrorKind, Result};

use super::{in_database, off_thread};

const LOGS_IN_BUNDLE: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataStatus {
    pub folder: String,
    pub database: String,
    pub projects: usize,
    pub missing: usize,
    pub runs: usize,
}

pub fn data_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path().app_data_dir().map_err(|error| {
        BackendError::internal(format!("The data folder could not be found: {error}"))
    })
}

#[tauri::command]
pub async fn data_status(app: AppHandle, db: State<'_, Arc<Database>>) -> Result<DataStatus> {
    let folder = data_dir(&app)?;
    let projects = in_database(&db, repositories::projects::list).await?;
    let runs = in_database(&db, repositories::executions::count).await?;
    let missing = projects
        .iter()
        .filter(|project| project.availability == crate::domain::project::Availability::Missing)
        .count();

    Ok(DataStatus {
        database: folder.join("pulso.db").to_string_lossy().into_owned(),
        folder: folder.to_string_lossy().into_owned(),
        projects: projects.len(),
        missing,
        runs,
    })
}

#[tauri::command]
pub async fn reveal_data_folder(app: AppHandle) -> Result<()> {
    let folder = data_dir(&app)?;

    crate::platform::macos::apps::open_with(None, &folder.to_string_lossy())
}

#[tauri::command]
pub async fn export_projects(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> Result<Option<String>> {
    let bundle = in_database(&db, transfer::export).await?;

    let Some(path) = picker::save_file(&app, "pulso-projects.json".to_string()).await else {
        return Ok(None);
    };

    let json = serde_json::to_string_pretty(&bundle).map_err(|error| {
        BackendError::internal(format!("The projects could not be written: {error}"))
    })?;

    let target = PathBuf::from(&path);
    std::fs::write(&target, json).map_err(|error| {
        BackendError::at(
            ErrorKind::Unreadable,
            &target,
            format!("The file could not be written: {error}"),
        )
    })?;

    Ok(Some(path))
}

#[tauri::command]
pub async fn import_projects(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> Result<Option<usize>> {
    let Some(path) = picker::open_file(&app, "Import projects".to_string()).await else {
        return Ok(None);
    };

    let target = PathBuf::from(&path);
    let raw = std::fs::read_to_string(&target).map_err(|error| {
        BackendError::at(
            ErrorKind::Unreadable,
            &target,
            format!("The file could not be read: {error}"),
        )
    })?;

    let bundle: transfer::Bundle = serde_json::from_str(&raw).map_err(|error| {
        BackendError::new(
            ErrorKind::InvalidInput,
            format!("That file is not a Pulso project list: {error}"),
        )
    })?;

    let added = in_database(&db, move |conn| transfer::import(conn, &bundle)).await?;

    events::broadcast_projects(&app).await;

    Ok(Some(added))
}

/// Everything needed to explain a problem in an issue, in one file: what Pulso
/// knows, what it is set to, where it looked, and what the processes said.
#[tauri::command]
pub async fn diagnostic_bundle(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    supervisor: State<'_, Arc<crate::process::supervisor::ProcessSupervisor>>,
) -> Result<Option<String>> {
    let Some(path) = picker::save_file(&app, "pulso-diagnostic.zip".to_string()).await else {
        return Ok(None);
    };

    let bundle = in_database(&db, transfer::export).await?;
    let preferences = in_database(&db, settings::read_preferences).await?;
    let projects = in_database(&db, repositories::projects::list).await?;

    let mut files: Vec<(String, Vec<u8>)> = Vec::new();
    files.push((
        "projects.json".to_string(),
        serde_json::to_vec_pretty(&bundle).unwrap_or_default(),
    ));
    files.push((
        "preferences.json".to_string(),
        serde_json::to_vec_pretty(&preferences).unwrap_or_default(),
    ));
    files.push((
        "versions.txt".to_string(),
        format!(
            "Pulso {}\nmacOS {}\nlog lines per process: {}\n",
            env!("CARGO_PKG_VERSION"),
            sysinfo::System::long_os_version().unwrap_or_else(|| "unknown".to_string()),
            supervisor.log_lines()
        )
        .into_bytes(),
    ));
    files.push((
        "environment.txt".to_string(),
        environment_text(&app, &projects).into_bytes(),
    ));

    for execution in supervisor.list() {
        let snapshot = supervisor.logs(execution.id, None, LOGS_IN_BUNDLE)?;
        let body = snapshot
            .lines
            .iter()
            .map(|line| {
                let stream = match line.stream {
                    crate::domain::log::LogStream::Stdout => "out",
                    crate::domain::log::LogStream::Stderr => "err",
                };

                format!("{} {} {}\n", line.seq, stream, line.text)
            })
            .collect::<String>();

        files.push((
            format!(
                "logs/{}-{}.log",
                execution.id,
                execution.command_id.replace(':', "-")
            ),
            body.into_bytes(),
        ));
    }

    let target = PathBuf::from(&path);
    off_thread(move || archive::write_zip(&target, &files)).await??;

    Ok(Some(path))
}

fn environment_text(app: &AppHandle, projects: &[crate::domain::project::Project]) -> String {
    let Some(supervisor) = app.try_state::<Arc<crate::process::supervisor::ProcessSupervisor>>()
    else {
        return "The process supervisor is not there.\n".to_string();
    };

    let mut text = String::new();

    for project in projects {
        let environment = supervisor.environment(std::path::Path::new(&project.path));
        text.push_str(&format!(
            "## {}\n{}\nPATH {}\n\n",
            project.name,
            project.path,
            environment.get("PATH").cloned().unwrap_or_default()
        ));
    }

    text
}
