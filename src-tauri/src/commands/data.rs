use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::app::picker;
use crate::commands::settings;
use crate::events;
use crate::persistence::{repositories, transfer, Database};
use crate::support::archive;
use crate::support::error::{BackendError, ErrorKind, Result};

use super::{in_database, off_thread};

const LOGS_IN_BUNDLE: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataStatus {
    pub folder: String,
    pub database: String,
    pub projects: usize,
    pub missing: usize,
    pub runs: usize,
}

pub fn data_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path().app_data_dir().map_err(|error| {
        BackendError::internal(format!("The data folder could not be found: {error}"))
    })
}

#[tauri::command]
pub async fn data_status(app: AppHandle, db: State<'_, Arc<Database>>) -> Result<DataStatus> {
    let folder = data_dir(&app)?;
    let projects = in_database(&db, repositories::projects::list).await?;
    let runs = in_database(&db, repositories::executions::count).await?;
    let missing = projects
        .iter()
        .filter(|project| project.availability == crate::domain::project::Availability::Missing)
        .count();

    Ok(DataStatus {
        database: folder.join("pulso.db").to_string_lossy().into_owned(),
        folder: folder.to_string_lossy().into_owned(),
        projects: projects.len(),
        missing,
        runs,
    })
}

#[tauri::command]
pub async fn reveal_data_folder(app: AppHandle) -> Result<()> {
    let folder = data_dir(&app)?;

    crate::platform::macos::apps::open_with(None, &folder.to_string_lossy())
}

#[tauri::command]
pub async fn export_projects(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> Result<Option<String>> {
    let bundle = in_database(&db, transfer::export).await?;

    let Some(path) = picker::save_file(&app, "pulso-projects.json".to_string()).await else {
        return Ok(None);
    };

    let json = serde_json::to_string_pretty(&bundle).map_err(|error| {
        BackendError::internal(format!("The projects could not be written: {error}"))
    })?;

    let target = PathBuf::from(&path);
    std::fs::write(&target, json).map_err(|error| {
        BackendError::at(
            ErrorKind::Unreadable,
            &target,
            format!("The file could not be written: {error}"),
        )
    })?;

    Ok(Some(path))
}

#[tauri::command]
pub async fn import_projects(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> Result<Option<usize>> {
    let Some(path) = picker::open_file(&app, "Import projects".to_string()).await else {
        return Ok(None);
    };

    let target = PathBuf::from(&path);
    let raw = std::fs::read_to_string(&target).map_err(|error| {
        BackendError::at(
            ErrorKind::Unreadable,
            &target,
            format!("The file could not be read: {error}"),
        )
    })?;

    let bundle: transfer::Bundle = serde_json::from_str(&raw).map_err(|error| {
        BackendError::new(
            ErrorKind::InvalidInput,
            format!("That file is not a Pulso project list: {error}"),
        )
    })?;

    let added = in_database(&db, move |conn| transfer::import(conn, &bundle)).await?;

    events::broadcast_projects(&app).await;

    Ok(Some(added))
}

/// Everything needed to explain a problem in an issue, in one file: what Pulso
/// knows, what it is set to, where it looked, and what the processes said.
#[tauri::command]
pub async fn diagnostic_bundle(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    supervisor: State<'_, Arc<crate::process::supervisor::ProcessSupervisor>>,
) -> Result<Option<String>> {
    let Some(path) = picker::save_file(&app, "pulso-diagnostic.zip".to_string()).await else {
        return Ok(None);
    };

    let bundle = in_database(&db, transfer::export).await?;
    let preferences = in_database(&db, settings::read_preferences).await?;
    let projects = in_database(&db, repositories::projects::list).await?;

    let mut files: Vec<(String, Vec<u8>)> = Vec::new();
    files.push((
        "projects.json".to_string(),
        serde_json::to_vec_pretty(&bundle).unwrap_or_default(),
    ));
    files.push((
        "preferences.json".to_string(),
        serde_json::to_vec_pretty(&preferences).unwrap_or_default(),
    ));
    files.push((
        "versions.txt".to_string(),
        format!(
            "Pulso {}\nmacOS {}\nlog lines per process: {}\n",
            env!("CARGO_PKG_VERSION"),
            sysinfo::System::long_os_version().unwrap_or_else(|| "unknown".to_string()),
            supervisor.log_lines()
        )
        .into_bytes(),
    ));
    files.push((
        "environment.txt".to_string(),
        environment_text(&app, &projects).into_bytes(),
    ));

    for execution in supervisor.list() {
        let snapshot = supervisor.logs(execution.id, None, LOGS_IN_BUNDLE)?;
        let body = snapshot
            .lines
            .iter()
            .map(|line| {
                let stream = match line.stream {
                    crate::domain::log::LogStream::Stdout => "out",
                    crate::domain::log::LogStream::Stderr => "err",
                };

                format!("{} {} {}\n", line.seq, stream, redact_secrets(&line.text))
            })
            .collect::<String>();

        files.push((
            format!(
                "logs/{}-{}.log",
                execution.id,
                bundle_name(&execution.command_id)
            ),
            body.into_bytes(),
        ));
    }

    let target = PathBuf::from(&path);
    off_thread(move || archive::write_zip(&target, &files)).await??;

    Ok(Some(path))
}

const SECRET_PREFIXES: [&str; 16] = [
    "sk-ant-",
    "sk-",
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_",
    "github_pat_",
    "xoxa-",
    "xoxb-",
    "xoxp-",
    "xoxs-",
    "AKIA",
    "AIza",
    "-----BEGIN",
    "Bearer ",
];

const SECRET_KEYS: [&str; 8] = [
    "password", "passwd", "secret", "token", "api_key", "api-key", "apikey", "auth",
];

fn is_secret_char(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'/' | b'+' | b'=')
}

fn redact_secrets(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;

    loop {
        let Some((value_at, value_end)) = next_secret(rest) else {
            out.push_str(rest);
            break;
        };
        out.push_str(&rest[..value_at]);
        out.push_str("[redacted]");
        rest = &rest[value_end..];
    }

    out
}

fn next_secret(text: &str) -> Option<(usize, usize)> {
    let lowered = text.to_ascii_lowercase();
    let mut best: Option<(usize, usize)> = None;
    let mut consider = |candidate: Option<(usize, usize)>| {
        if let Some(found) = candidate {
            if best.map(|known| found.0 < known.0).unwrap_or(true) {
                best = Some(found);
            }
        }
    };

    for prefix in SECRET_PREFIXES {
        consider(prefix_value(text, prefix));
    }
    for key in SECRET_KEYS {
        consider(key_value(&lowered, key));
    }

    best
}

fn prefix_value(text: &str, prefix: &str) -> Option<(usize, usize)> {
    let at = text.find(prefix)?;
    let start = at + prefix.len();

    if prefix == "-----BEGIN" {
        let mut end = start;
        while end < text.len() && text.as_bytes()[end] != b'\n' {
            end += 1;
        }
        return Some((at, end));
    }

    let mut end = start;
    while text
        .as_bytes()
        .get(end)
        .copied()
        .map(is_secret_char)
        .unwrap_or(false)
    {
        end += 1;
    }

    if end == start {
        return None;
    }

    Some((at, end))
}

fn key_value(lowered: &str, key: &str) -> Option<(usize, usize)> {
    let bytes = lowered.as_bytes();
    let mut from = 0;

    while let Some(relative) = lowered[from..].find(key) {
        let at = from + relative;
        let mut cursor = at + key.len();

        while matches!(bytes.get(cursor).copied(), Some(b' ') | Some(b'\t')) {
            cursor += 1;
        }
        if !matches!(bytes.get(cursor).copied(), Some(b'=') | Some(b':')) {
            from = at + 1;
            continue;
        }
        cursor += 1;
        while matches!(bytes.get(cursor).copied(), Some(b' ') | Some(b'\t')) {
            cursor += 1;
        }

        let quote = bytes
            .get(cursor)
            .copied()
            .filter(|byte| *byte == b'\'' || *byte == b'"');
        if quote.is_some() {
            cursor += 1;
        }

        let mut end = cursor;
        if let Some(mark) = quote {
            while end < lowered.len() && bytes[end] != mark {
                end += 1;
            }
            if end < lowered.len() {
                end += 1;
            }
        } else {
            while bytes.get(end).copied().map(is_secret_char).unwrap_or(false) {
                end += 1;
            }
        }

        if end == cursor {
            from = at + 1;
            continue;
        }

        return Some((cursor, end));
    }

    None
}

fn bundle_name(command_id: &str) -> String {
    let mut name: String = command_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();

    while name.contains("--") {
        name = name.replace("--", "-");
    }

    name.trim_matches('-').to_string()
}

fn environment_text(app: &AppHandle, projects: &[crate::domain::project::Project]) -> String {
    let Some(supervisor) = app.try_state::<Arc<crate::process::supervisor::ProcessSupervisor>>()
    else {
        return "The process supervisor is not there.\n".to_string();
    };

    let mut text = String::new();

    for project in projects {
        let environment = supervisor.environment(std::path::Path::new(&project.path));
        text.push_str(&format!(
            "## {}\n{}\nPATH {}\n\n",
            project.name,
            project.path,
            environment.get("PATH").cloned().unwrap_or_default()
        ));
    }

    text
}

#[cfg(test)]
mod tests {
    use super::{bundle_name, redact_secrets};

    #[test]
    fn plain_ids_survive() {
        assert_eq!(bundle_name("package_json-dev"), "package_json-dev");
    }

    #[test]
    fn separators_and_dots_become_single_dashes() {
        assert_eq!(bundle_name("package_json:../../evil"), "package_json-evil");
        assert_eq!(bundle_name("makefile:a/b\\c"), "makefile-a-b-c");
    }

    #[test]
    fn tokens_are_masked_but_context_survives() {
        assert_eq!(
            redact_secrets("key sk-abcDEF123 done"),
            "key [redacted] done"
        );
        assert_eq!(
            redact_secrets("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.cGF5bG9hZA.SflKxwRJ"),
            "Authorization: [redacted]"
        );
    }

    #[test]
    fn assignments_are_masked_with_quotes_or_bare() {
        assert_eq!(
            redact_secrets("password=hunter2; user=bryan"),
            "password=[redacted]; user=bryan"
        );
        assert_eq!(
            redact_secrets("API_KEY: \"abc-123_xyz\" ok"),
            "API_KEY: \"[redacted] ok"
        );
        assert_eq!(
            redact_secrets("the token authenticates the user"),
            "the token authenticates the user"
        );
    }

    #[test]
    fn key_material_headers_are_masked() {
        assert_eq!(
            redact_secrets("-----BEGIN RSA PRIVATE KEY-----").starts_with("[redacted]"),
            true
        );
        assert_eq!(redact_secrets("listening on :3000"), "listening on :3000");
    }

    #[test]
    fn an_empty_or_hostile_id_still_names_a_file() {
        assert!(!bundle_name("../../..").contains('.'));
        assert!(!bundle_name("../../..").contains('/'));
    }
}
