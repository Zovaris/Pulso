use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::events;
use crate::persistence::{repositories, Database};
use crate::support::error::{BackendError, ErrorKind, Result};

use super::in_database;

const THEME_KEY: &str = "ui.theme";
const TRANSPARENCY_KEY: &str = "ui.transparency";
const LOCALE_KEY: &str = "ui.locale";

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
    fn parse(value: &str) -> Option<Self> {
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
}

#[tauri::command]
pub async fn get_preferences(db: State<'_, Arc<Database>>) -> Result<Option<Preferences>> {
    let stored = in_database(&db, |conn| {
        Ok((
            repositories::settings::get(conn, THEME_KEY)?,
            repositories::settings::get(conn, TRANSPARENCY_KEY)?,
            repositories::settings::get(conn, LOCALE_KEY)?,
        ))
    })
    .await?;

    let (theme, transparency, locale) = stored;
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
    }))
}

#[tauri::command]
pub async fn save_preferences(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    theme: String,
    transparency: bool,
    locale: String,
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
    };

    in_database(&db, move |conn| {
        repositories::settings::set(conn, THEME_KEY, theme.as_str())?;
        repositories::settings::set(conn, TRANSPARENCY_KEY, if transparency { "1" } else { "0" })?;
        repositories::settings::set(conn, LOCALE_KEY, locale.as_str())
    })
    .await?;

    events::preferences_changed(&app, &preferences);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_theme_survives_a_round_trip() {
        for theme in [ThemePref::Dark, ThemePref::Light, ThemePref::System] {
            assert_eq!(ThemePref::parse(theme.as_str()), Some(theme));
        }
    }

    #[test]
    fn a_theme_nobody_ships_is_refused() {
        assert_eq!(ThemePref::parse("midnight"), None);
        assert_eq!(ThemePref::parse("Dark"), None);
    }

    #[test]
    fn every_locale_survives_a_round_trip() {
        for locale in [Locale::Es, Locale::En] {
            assert_eq!(Locale::parse(locale.as_str()), Some(locale));
        }
    }

    #[test]
    fn a_locale_nobody_ships_is_refused() {
        assert_eq!(Locale::parse("pt"), None);
        assert_eq!(Locale::parse(""), None);
    }

    #[test]
    fn preferences_reach_the_frontend_the_way_it_reads_them() {
        let json = serde_json::to_value(Preferences {
            theme: ThemePref::System,
            transparency: true,
            locale: Locale::Es,
        })
        .expect("preferences should serialize");

        assert_eq!(json["theme"], "system");
        assert_eq!(json["transparency"], true);
        assert_eq!(json["locale"], "es");
    }

    #[test]
    fn the_stored_keys_stay_where_the_preferences_were_written() {
        assert_eq!(THEME_KEY, "ui.theme");
        assert_eq!(TRANSPARENCY_KEY, "ui.transparency");
        assert_eq!(LOCALE_KEY, "ui.locale");
    }
}
