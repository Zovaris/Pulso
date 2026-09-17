use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::commands::settings;
use crate::events;
use crate::persistence::{repositories, Database};
use crate::platform::macos::apps::{self, KnownApp};
use crate::support::base64;
use crate::support::error::{BackendError, ErrorKind, Result};

use super::{in_database, off_thread};

/// Big enough for a retina chip, small enough that the IPC payload stays tiny.
const ICON_SIZE: f64 = 32.0;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorTarget {
    pub id: String,
    pub name: String,
    pub bundle_id: String,
    pub path: String,
}

pub fn installed_ids() -> Vec<String> {
    apps::EDITORS
        .iter()
        .filter(|app| apps::bundle_path(app.bundle_id).is_some())
        .map(|app| app.id.to_string())
        .collect()
}

#[tauri::command]
pub async fn list_editors() -> Result<Vec<EditorTarget>> {
    off_thread(|| {
        apps::EDITORS
            .iter()
            .filter_map(|app| {
                let path = apps::bundle_path(app.bundle_id)?;

                Some(EditorTarget {
                    id: app.id.to_string(),
                    name: app.name.to_string(),
                    bundle_id: app.bundle_id.to_string(),
                    path: path.to_string_lossy().into_owned(),
                })
            })
            .collect()
    })
    .await
}

/// The icon the user actually has installed, asked of AppKit and sent as a data
/// URL so the webview can put it straight in an `<img>`. We draw nothing and
/// ship nothing: it is their app, at the version they have.
#[tauri::command]
pub async fn app_icon(editor_id: String) -> Result<Option<String>> {
    off_thread(move || {
        let app = apps::editor(&editor_id)?;
        let path = apps::bundle_path(app.bundle_id)?;
        let png = apps::icon_png(&path, ICON_SIZE)?;

        Some(format!("data:image/png;base64,{}", base64::encode(&png)))
    })
    .await
}

/// Hands the folder to the editor. With no editor installed the folder is
/// revealed in Finder instead, which is the only honest thing left to do.
#[tauri::command]
pub async fn open_project(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    project_id: i64,
    editor_id: Option<String>,
) -> Result<Option<String>> {
    let project = in_database(&db, move |conn| {
        repositories::projects::by_id(conn, project_id)
    })
    .await?
    .ok_or_else(|| BackendError::new(ErrorKind::NotFound, "That project is no longer in Pulso."))?;

    let stored = crate::commands::settings::stored_editor(&app);
    let requested = editor_id.or(stored);

    let chosen = off_thread(move || {
        let installed = installed_ids();
        apps::choose(requested.as_deref(), &installed)
    })
    .await?;

    let Some(target) = chosen else {
        apps::open_with(None, &project.path)?;
        return Ok(None);
    };

    let revealed = target.id == apps::FINDER.id;
    let bundle = (!revealed).then_some(target.bundle_id);
    apps::open_with(bundle, &project.path)?;

    if !revealed {
        remember(&app, &db, target).await?;
    }

    Ok(Some(target.id.to_string()))
}

/// Opening in an editor also makes it the default, which is what the next
/// `⌘O` and the header's main button use. Both windows hear about it so the
/// Ajustes row cannot disagree with what just happened.
async fn remember(app: &AppHandle, db: &State<'_, Arc<Database>>, target: KnownApp) -> Result<()> {
    let id = target.id.to_string();

    in_database(db, move |conn| {
        repositories::settings::set(conn, settings::EDITOR_KEY, &id)
    })
    .await?;

    let current = in_database(db, settings::read_preferences).await?;
    if let Some(current) = current {
        events::preferences_changed(app, &current);
    }

    Ok(())
}
