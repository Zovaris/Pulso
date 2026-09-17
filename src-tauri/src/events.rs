use std::path::Path;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::settings::Preferences;
use crate::domain::command::CommandScan;
use crate::domain::execution::Execution;
use crate::domain::log::LogLine;
use crate::domain::metrics::MetricSample;
use crate::domain::project::Project;
use crate::persistence::repositories::flags::FlagsByCommand;
use crate::persistence::{repositories, Database};

pub const PROJECTS_CHANGED: &str = "project://changed";
pub const COMMANDS_CHANGED: &str = "project://commands-changed";
pub const COMMAND_FLAGS_CHANGED: &str = "project://flags-changed";
pub const EXECUTION_CHANGED: &str = "execution://state-changed";
pub const EXECUTION_METRICS: &str = "execution://metrics";
pub const LOG_APPENDED: &str = "execution://log-appended";
pub const POPOVER_PREPARE: &str = "popover://prepare";
pub const POPOVER_SHOWN: &str = "popover://shown";
pub const POPOVER_CLOSING: &str = "popover://closing";
pub const PREFERENCES_CHANGED: &str = "settings://changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectsChanged {
    pub projects: Vec<Project>,
}

pub fn projects_changed(app: &AppHandle, projects: Vec<Project>) {
    let _ = app.emit(PROJECTS_CHANGED, ProjectsChanged { projects });
}

pub fn commands_changed(app: &AppHandle, scan: &CommandScan) {
    let _ = app.emit(COMMANDS_CHANGED, scan);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlagsChanged {
    pub project_id: i64,
    pub flags: FlagsByCommand,
}

/// Sent instead of a whole scan, because toggling a favourite should not make
/// Pulso read every project file again.
pub fn command_flags_changed(app: &AppHandle, project_id: i64, flags: &FlagsByCommand) {
    let _ = app.emit(
        COMMAND_FLAGS_CHANGED,
        FlagsChanged {
            project_id,
            flags: flags.clone(),
        },
    );
}

pub fn preferences_changed(app: &AppHandle, preferences: &Preferences) {
    let _ = app.emit(PREFERENCES_CHANGED, preferences);
}

pub fn popover_prepare(app: &AppHandle) {
    let _ = app.emit(POPOVER_PREPARE, ());
}

pub fn popover_shown(app: &AppHandle) {
    let _ = app.emit(POPOVER_SHOWN, ());
}

pub fn popover_closing(app: &AppHandle) {
    let _ = app.emit(POPOVER_CLOSING, ());
}

pub fn execution_changed(app: &AppHandle, execution: &Execution) {
    let _ = app.emit(EXECUTION_CHANGED, execution);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogAppended {
    pub execution_id: i64,
    pub lines: Vec<LogLine>,
}

pub fn log_appended(app: &AppHandle, execution_id: i64, lines: &[LogLine]) {
    let _ = app.emit(
        LOG_APPENDED,
        LogAppended {
            execution_id,
            lines: lines.to_vec(),
        },
    );
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsChanged {
    pub samples: Vec<MetricSample>,
}

pub fn execution_metrics(app: &AppHandle, samples: &[MetricSample]) {
    let _ = app.emit(
        EXECUTION_METRICS,
        MetricsChanged {
            samples: samples.to_vec(),
        },
    );
}

pub async fn broadcast_projects(app: &AppHandle) -> Option<Vec<Project>> {
    let projects = read_projects(app).await?;
    projects_changed(app, projects.clone());
    Some(projects)
}

pub async fn refresh(app: &AppHandle) {
    let Some(projects) = broadcast_projects(app).await else {
        return;
    };
    let Some(database) = app
        .try_state::<Arc<Database>>()
        .map(|state| Arc::clone(state.inner()))
    else {
        return;
    };

    for project in projects {
        let id = project.id;
        let Some(mut scan) = scan_project(id, project.path).await else {
            continue;
        };

        let reading = Arc::clone(&database);
        if let Ok(Ok(flags)) = tauri::async_runtime::spawn_blocking(move || {
            reading.with(|conn| repositories::flags::for_project(conn, id))
        })
        .await
        {
            scan.flags = flags;
        }

        commands_changed(app, &scan);
    }
}

async fn read_projects(app: &AppHandle) -> Option<Vec<Project>> {
    let database = Arc::clone(app.try_state::<Arc<Database>>()?.inner());

    tauri::async_runtime::spawn_blocking(move || database.with(repositories::projects::list))
        .await
        .ok()?
        .ok()
}

async fn scan_project(project_id: i64, path: String) -> Option<CommandScan> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::detectors::scan(project_id, Path::new(&path))
    })
    .await
    .ok()
}
