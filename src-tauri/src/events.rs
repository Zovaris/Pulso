use std::path::Path;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::settings::Preferences;
use crate::domain::command::CommandScan;
use crate::domain::execution::Execution;
use crate::domain::log::LogLine;
use crate::domain::project::Project;
use crate::persistence::{repositories, Database};

pub const PROJECTS_CHANGED: &str = "project://changed";
pub const COMMANDS_CHANGED: &str = "project://commands-changed";
pub const EXECUTION_CHANGED: &str = "execution://state-changed";
pub const LOG_APPENDED: &str = "execution://log-appended";
pub const POPOVER_SHOWN: &str = "popover://shown";
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

pub fn preferences_changed(app: &AppHandle, preferences: &Preferences) {
    let _ = app.emit(PREFERENCES_CHANGED, preferences);
}

pub fn popover_shown(app: &AppHandle) {
    let _ = app.emit(POPOVER_SHOWN, ());
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

pub async fn broadcast_projects(app: &AppHandle) -> Option<Vec<Project>> {
    let projects = read_projects(app).await?;
    projects_changed(app, projects.clone());
    Some(projects)
}

pub async fn refresh(app: &AppHandle) {
    let Some(projects) = broadcast_projects(app).await else {
        return;
    };

    for project in projects {
        if let Some(scan) = scan_project(project.id, project.path).await {
            commands_changed(app, &scan);
        }
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
