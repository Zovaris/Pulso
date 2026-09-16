use std::path::Path;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::domain::command::CommandScan;
use crate::domain::execution::Execution;
use crate::domain::project::Project;
use crate::persistence::{repositories, Database};

pub const PROJECTS_CHANGED: &str = "project://changed";
pub const COMMANDS_CHANGED: &str = "project://commands-changed";
pub const EXECUTION_CHANGED: &str = "execution://state-changed";

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

pub fn execution_changed(app: &AppHandle, execution: &Execution) {
    let _ = app.emit(EXECUTION_CHANGED, execution);
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
