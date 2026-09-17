use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::events;
use crate::persistence::{repositories, Database};
use crate::support::error::{BackendError, ErrorKind, Result};

use super::in_database;

const THEME_KEY: &str = "ui.theme";
const TRANSPARENCY_KEY: &str = "ui.transparency";
const LOCALE_KEY: &str = "ui.locale";
const SOUND_KEY: &str = "ui.sound";
pub const EDITOR_KEY: &str = "ui.editor";
const OPEN_AT_LOGIN_KEY: &str = "ui.openAtLogin";
const KEEP_RUNNING_KEY: &str = "ui.keepRunning";
const CONFIRM_STOP_KEY: &str = "ui.confirmStop";
const NOTIFY_ON_FAILURE_KEY: &str = "ui.notifyOnFailure";
pub const LOG_LINES_KEY: &str = "logs.maxLines";

pub const DEFAULT_LOG_LINES: usize = 4000;
pub const LOG_LINE_CHOICES: [usize; 5] = [500, 1000, 2000, 4000, 10000];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePref {
    Dark,
    Light,
    System,
}

impl ThemePref {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "dark" => Some(Self::Dark),
            "light" => Some(Self::Light),
            "system" => Some(Self::System),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Dark => "dark",
            Self::Light => "light",
            Self::System => "system",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    Es,
    En,
}

impl Locale {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "es" => Some(Self::Es),
            "en" => Some(Self::En),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Es => "es",
            Self::En => "en",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub theme: ThemePref,
    pub transparency: bool,
    pub locale: Locale,
    pub sound: bool,
    /// The editor `⌘O` and the project header hand the folder to. `None` means
    /// "whichever one Pulso found first".
    #[serde(default)]
    pub editor: Option<String>,
    #[serde(default)]
    pub open_at_login: bool,
    #[serde(default = "default_true")]
    pub keep_running: bool,
    #[serde(default)]
    pub confirm_stop: bool,
    #[serde(default = "default_true")]
    pub notify_on_failure: bool,
    #[serde(default = "default_log_lines")]
    pub log_lines: usize,
}

fn default_true() -> bool {
    true
}

fn default_log_lines() -> usize {
    DEFAULT_LOG_LINES
}

fn bool_pref(stored: Option<&str>, fallback: bool) -> bool {
    match stored {
        Some("1") => true,
        Some("0") => false,
        _ => fallback,
    }
}

fn log_lines_pref(stored: Option<&str>) -> usize {
    stored
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|lines| LOG_LINE_CHOICES.contains(lines))
        .unwrap_or(DEFAULT_LOG_LINES)
}

#[tauri::command]
pub async fn get_preferences(db: State<'_, Arc<Database>>) -> Result<Option<Preferences>> {
    in_database(&db, read_preferences).await
}

pub fn read_preferences(conn: &rusqlite::Connection) -> Result<Option<Preferences>> {
    let stored = (
        repositories::settings::get(conn, THEME_KEY)?,
        repositories::settings::get(conn, TRANSPARENCY_KEY)?,
        repositories::settings::get(conn, LOCALE_KEY)?,
        repositories::settings::get(conn, SOUND_KEY)?,
        repositories::settings::get(conn, EDITOR_KEY)?,
        repositories::settings::get(conn, OPEN_AT_LOGIN_KEY)?,
        repositories::settings::get(conn, KEEP_RUNNING_KEY)?,
        repositories::settings::get(conn, CONFIRM_STOP_KEY)?,
        repositories::settings::get(conn, NOTIFY_ON_FAILURE_KEY)?,
        repositories::settings::get(conn, LOG_LINES_KEY)?,
    );

    let (
        theme,
        transparency,
        locale,
        sound,
        editor,
        open_at_login,
        keep_running,
        confirm_stop,
        notify_on_failure,
        log_lines,
    ) = stored;

    let (Some(theme), Some(locale)) = (theme, locale) else {
        return Ok(None);
    };

    let theme = ThemePref::parse(&theme).ok_or_else(|| {
        BackendError::new(
            ErrorKind::Storage,
            "The stored theme is not one Pulso knows.",
        )
    })?;
    let locale = Locale::parse(&locale).ok_or_else(|| {
        BackendError::new(
            ErrorKind::Storage,
            "The stored language is not one Pulso knows.",
        )
    })?;

    Ok(Some(Preferences {
        theme,
        transparency: transparency.as_deref() == Some("1"),
        locale,
        sound: sound_pref(sound.as_deref()),
        editor: editor.filter(|value| !value.is_empty()),
        open_at_login: bool_pref(open_at_login.as_deref(), false),
        keep_running: bool_pref(keep_running.as_deref(), true),
        confirm_stop: bool_pref(confirm_stop.as_deref(), false),
        notify_on_failure: bool_pref(notify_on_failure.as_deref(), true),
        log_lines: log_lines_pref(log_lines.as_deref()),
    }))
}

fn sound_pref(stored: Option<&str>) -> bool {
    stored != Some("0")
}

pub fn sound_cues(app: &AppHandle) -> bool {
    read(app, SOUND_KEY)
        .map(|value| sound_pref(value.as_deref()))
        .unwrap_or(true)
}

pub fn stored_locale(app: &AppHandle) -> Locale {
    read(app, LOCALE_KEY)
        .flatten()
        .as_deref()
        .and_then(Locale::parse)
        .unwrap_or(Locale::En)
}

/// How many log lines the supervisor keeps per execution.
pub fn log_lines(app: &AppHandle) -> usize {
    read(app, LOG_LINES_KEY)
        .map(|value| log_lines_pref(value.as_deref()))
        .unwrap_or(DEFAULT_LOG_LINES)
}

pub fn keep_running(app: &AppHandle) -> bool {
    read(app, KEEP_RUNNING_KEY)
        .map(|value| bool_pref(value.as_deref(), true))
        .unwrap_or(true)
}

pub fn notify_on_failure(app: &AppHandle) -> bool {
    read(app, NOTIFY_ON_FAILURE_KEY)
        .map(|value| bool_pref(value.as_deref(), true))
        .unwrap_or(true)
}

pub fn stored_editor(app: &AppHandle) -> Option<String> {
    read(app, EDITOR_KEY)
        .flatten()
        .filter(|value| !value.is_empty())
}

fn read(app: &AppHandle, key: &str) -> Option<Option<String>> {
    let database = app.try_state::<Arc<Database>>()?;

    database
        .with(|conn| repositories::settings::get(conn, key))
        .ok()
}

#[tauri::command]
pub async fn save_preferences(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    preferences: Preferences,
) -> Result<Preferences> {
    if !LOG_LINE_CHOICES.contains(&preferences.log_lines) {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            format!(
                "{} is not a log line count Pulso offers.",
                preferences.log_lines
            ),
        ));
    }

    if let Some(editor) = preferences.editor.clone() {
        if crate::platform::macos::apps::editor(&editor).is_none() {
            return Err(BackendError::new(
                ErrorKind::InvalidInput,
                format!("{editor} is not an editor Pulso knows."),
            ));
        }

        let installed = super::off_thread(super::editors::installed_ids).await?;
        if !crate::platform::macos::apps::is_installed(&editor, &installed) {
            return Err(BackendError::new(
                ErrorKind::InvalidInput,
                format!("{editor} is not installed on this Mac."),
            ));
        }
    }

    let stored = preferences.clone();

    in_database(&db, move |conn| {
        let theme = stored.theme.as_str();
        let locale = stored.locale.as_str();

        repositories::settings::set(conn, THEME_KEY, theme)?;
        repositories::settings::set(
            conn,
            TRANSPARENCY_KEY,
            if stored.transparency { "1" } else { "0" },
        )?;
        repositories::settings::set(conn, LOCALE_KEY, locale)?;
        repositories::settings::set(conn, SOUND_KEY, if stored.sound { "1" } else { "0" })?;
        repositories::settings::set(conn, EDITOR_KEY, stored.editor.as_deref().unwrap_or(""))?;
        repositories::settings::set(
            conn,
            OPEN_AT_LOGIN_KEY,
            if stored.open_at_login { "1" } else { "0" },
        )?;
        repositories::settings::set(
            conn,
            KEEP_RUNNING_KEY,
            if stored.keep_running { "1" } else { "0" },
        )?;
        repositories::settings::set(
            conn,
            CONFIRM_STOP_KEY,
            if stored.confirm_stop { "1" } else { "0" },
        )?;
        repositories::settings::set(
            conn,
            NOTIFY_ON_FAILURE_KEY,
            if stored.notify_on_failure { "1" } else { "0" },
        )?;
        repositories::settings::set(conn, LOG_LINES_KEY, &stored.log_lines.to_string())
    })
    .await?;

    crate::app::autostart::apply(preferences.open_at_login);
    if let Some(supervisor) = app.try_state::<Arc<crate::process::supervisor::ProcessSupervisor>>()
    {
        supervisor.set_log_lines(preferences.log_lines);
    }

    events::preferences_changed(&app, &preferences);
    crate::app::tray::sync(&app);

    Ok(preferences)
}

#[cfg(test)]
mod tests;
