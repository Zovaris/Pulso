use std::path::Path;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::domain::command::CommandScan;
use crate::domain::project::Project;
use crate::persistence::{repositories, Database};

pub const PROJECTS_CHANGED: &str = "project://changed";
pub const COMMANDS_CHANGED: &str = "project://commands-changed";

/// Payloads are additive-compatible: fields get added, never renamed or
/// retyped, so an older frontend keeps working against a newer backend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectsChanged {
    pub projects: Vec<Project>,
}

/// The full list, so a subscriber never has to merge.
pub fn projects_changed(app: &AppHandle, projects: Vec<Project>) {
    let _ = app.emit(PROJECTS_CHANGED, ProjectsChanged { projects });
}

pub fn commands_changed(app: &AppHandle, scan: &CommandScan) {
    let _ = app.emit(COMMANDS_CHANGED, scan);
}

/// Re-reads the list and pushes it to every window. Called after a mutation.
pub async fn broadcast_projects(app: &AppHandle) -> Option<Vec<Project>> {
    let projects = read_projects(app).await?;
    projects_changed(app, projects.clone());
    Some(projects)
}

/// Re-reads projects and re-derives every project's commands, then pushes both.
///
/// This is what keeps the popover honest when it opens: a manifest edited
/// outside Soffy, or a folder that was moved, shows up without the frontend
/// polling anything.
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
