use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::persistence::{repositories, Database};
use crate::support::error::{BackendError, ErrorKind, Result};

use super::in_database;

const THEME_KEY: &str = "appearance.theme";
const TRANSPARENCY_KEY: &str = "appearance.transparency";

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Appearance {
    pub theme: ThemePref,
    pub transparency: bool,
}

#[tauri::command]
pub async fn get_appearance(db: State<'_, Arc<Database>>) -> Result<Option<Appearance>> {
    let stored = in_database(&db, |conn| {
        Ok((
            repositories::settings::get(conn, THEME_KEY)?,
            repositories::settings::get(conn, TRANSPARENCY_KEY)?,
        ))
    })
    .await?;

    let (theme, transparency) = stored;
    let Some(theme) = theme else {
        return Ok(None);
    };

    let theme = ThemePref::parse(&theme).ok_or_else(|| {
        BackendError::new(
            ErrorKind::Storage,
            "The stored theme is not one Soffy knows.",
        )
    })?;

    Ok(Some(Appearance {
        theme,
        transparency: transparency.as_deref() == Some("1"),
    }))
}

#[tauri::command]
pub async fn save_appearance(
    db: State<'_, Arc<Database>>,
    theme: String,
    transparency: bool,
) -> Result<()> {
    let theme = ThemePref::parse(&theme).ok_or_else(|| {
        BackendError::new(ErrorKind::InvalidInput, format!("{theme} is not a theme."))
    })?;
    let transparency = if transparency { "1" } else { "0" };

    in_database(&db, move |conn| {
        repositories::settings::set(conn, THEME_KEY, theme.as_str())?;
        repositories::settings::set(conn, TRANSPARENCY_KEY, transparency)
    })
    .await
}
