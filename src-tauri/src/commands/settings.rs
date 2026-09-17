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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub theme: ThemePref,
    pub transparency: bool,
    pub locale: Locale,
    pub sound: bool,
}

#[tauri::command]
pub async fn get_preferences(db: State<'_, Arc<Database>>) -> Result<Option<Preferences>> {
    let stored = in_database(&db, |conn| {
        Ok((
            repositories::settings::get(conn, THEME_KEY)?,
            repositories::settings::get(conn, TRANSPARENCY_KEY)?,
            repositories::settings::get(conn, LOCALE_KEY)?,
            repositories::settings::get(conn, SOUND_KEY)?,
        ))
    })
    .await?;

    let (theme, transparency, locale, sound) = stored;
    let (Some(theme), Some(locale)) = (theme, locale) else {
        return Ok(None);
    };

    let theme = ThemePref::parse(&theme).ok_or_else(|| {
        BackendError::new(
            ErrorKind::Storage,
            "The stored theme is not one Soffy knows.",
        )
    })?;
    let locale = Locale::parse(&locale).ok_or_else(|| {
        BackendError::new(
            ErrorKind::Storage,
            "The stored language is not one Soffy knows.",
        )
    })?;

    Ok(Some(Preferences {
        theme,
        transparency: transparency.as_deref() == Some("1"),
        locale,
        sound: sound_pref(sound.as_deref()),
    }))
}

fn sound_pref(stored: Option<&str>) -> bool {
    stored != Some("0")
}

pub fn sound_cues(app: &AppHandle) -> bool {
    let Some(database) = app.try_state::<Arc<Database>>() else {
        return true;
    };

    sound_pref(
        database
            .with(|conn| repositories::settings::get(conn, SOUND_KEY))
            .ok()
            .flatten()
            .as_deref(),
    )
}

pub fn stored_locale(app: &AppHandle) -> Locale {
    let Some(database) = app.try_state::<Arc<Database>>() else {
        return Locale::En;
    };

    database
        .with(|conn| repositories::settings::get(conn, LOCALE_KEY))
        .ok()
        .flatten()
        .as_deref()
        .and_then(Locale::parse)
        .unwrap_or(Locale::En)
}

#[tauri::command]
pub async fn save_preferences(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    theme: String,
    transparency: bool,
    locale: String,
    sound: bool,
) -> Result<()> {
    let theme = ThemePref::parse(&theme).ok_or_else(|| {
        BackendError::new(ErrorKind::InvalidInput, format!("{theme} is not a theme."))
    })?;
    let locale = Locale::parse(&locale).ok_or_else(|| {
        BackendError::new(
            ErrorKind::InvalidInput,
            format!("{locale} is not a language."),
        )
    })?;

    let preferences = Preferences {
        theme,
        transparency,
        locale,
        sound,
    };

    in_database(&db, move |conn| {
        repositories::settings::set(conn, THEME_KEY, theme.as_str())?;
        repositories::settings::set(conn, TRANSPARENCY_KEY, if transparency { "1" } else { "0" })?;
        repositories::settings::set(conn, LOCALE_KEY, locale.as_str())?;
        repositories::settings::set(conn, SOUND_KEY, if sound { "1" } else { "0" })
    })
    .await?;

    events::preferences_changed(&app, &preferences);
    crate::app::tray::sync(&app);

    Ok(())
}

#[cfg(test)]
mod tests;
