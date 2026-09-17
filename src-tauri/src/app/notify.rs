use std::sync::Arc;

use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::commands::settings::{self, Locale};
use crate::domain::execution::{Execution, ExecutionState};
use crate::persistence::{repositories, Database};

/// A banner is only worth anything when nobody is looking at the reason for it.
/// With the window in front, the failed row already says what happened.
pub fn observe(app: &AppHandle, execution: &Execution) {
    if execution.state != ExecutionState::Failed || !settings::notify_on_failure(app) {
        return;
    }
    if crate::app::windows::main_window(app).is_some_and(|window| {
        window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)
    }) {
        return;
    }

    let project = project_name(app, execution.project_id);
    let text = body(
        settings::stored_locale(app),
        &project,
        &execution.label,
        execution.exit_code,
    );

    let _ = app
        .notification()
        .builder()
        .title("Pulso")
        .body(text)
        .show();
}

pub fn body(locale: Locale, project: &str, label: &str, exit_code: Option<i32>) -> String {
    let code = exit_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "—".to_string());

    match locale {
        Locale::Es => format!("{project} · {label} falló con código {code}."),
        Locale::En => format!("{project} · {label} failed with code {code}."),
    }
}

fn project_name(app: &AppHandle, project_id: i64) -> String {
    let Some(database) = app.try_state::<Arc<Database>>() else {
        return "Pulso".to_string();
    };

    database
        .with(|conn| repositories::projects::by_id(conn, project_id))
        .ok()
        .flatten()
        .map(|project| project.name)
        .unwrap_or_else(|| "Pulso".to_string())
}

#[cfg(test)]
mod tests;
