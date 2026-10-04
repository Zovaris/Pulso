use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::app::burst::{self, Burst};
use crate::app::cues::LONG_RUN_MS;
use crate::commands::settings::{self, Locale};
use crate::domain::execution::{Execution, ExecutionState};
use crate::persistence::{repositories, Database};

/// Long enough for a group's servers to all come up inside one banner.
const BURST: Duration = Duration::from_millis(1500);

/// A banner shows a few lines; past that it only needs to say how many more.
const LINES: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Kind {
    Failed,
    Ready,
    Done,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Notice {
    Failed {
        project: String,
        label: String,
        code: Option<i32>,
    },
    Ready {
        project: String,
        label: String,
        port: u16,
    },
    Done {
        project: String,
        label: String,
        took_ms: i64,
    },
}

impl Notice {
    fn kind(&self) -> Kind {
        match self {
            Notice::Failed { .. } => Kind::Failed,
            Notice::Ready { .. } => Kind::Ready,
            Notice::Done { .. } => Kind::Done,
        }
    }
}

/// What a run has already said, so each thing is said once: a failure, the
/// first port it opened, and a clean ending after a long run.
#[derive(Default)]
pub struct Tracker {
    states: HashMap<i64, ExecutionState>,
    ready: HashSet<i64>,
}

impl Tracker {
    pub fn observe(&mut self, execution: &Execution) -> Option<Kind> {
        let previous = self.states.insert(execution.id, execution.state);
        if execution.is_active() && !execution.ports.is_empty() && self.ready.insert(execution.id) {
            return Some(Kind::Ready);
        }
        if previous == Some(execution.state) {
            return None;
        }
        match execution.state {
            ExecutionState::Failed => Some(Kind::Failed),
            ExecutionState::Exited
                if previous != Some(ExecutionState::Stopping) && took(execution) >= LONG_RUN_MS =>
            {
                Some(Kind::Done)
            }
            _ => None,
        }
    }
}

static TRACKER: Mutex<Option<Tracker>> = Mutex::new(None);
static PENDING: Mutex<Option<Burst<Notice>>> = Mutex::new(None);

pub fn observe(app: &AppHandle, execution: &Execution) {
    let Some(kind) = TRACKER.lock().ok().and_then(|mut guard| {
        guard
            .get_or_insert_with(Tracker::default)
            .observe(execution)
    }) else {
        return;
    };
    let wanted = match kind {
        Kind::Failed => settings::notify_on_failure(app),
        Kind::Ready => settings::notify_on_ready(app),
        Kind::Done => settings::notify_on_done(app),
    };
    if !wanted {
        return;
    }

    let notice = notice(kind, project_name(app, execution.project_id), execution);
    let app = app.clone();
    burst::gather(&PENDING, notice, BURST, move |notices| show(&app, notices));
}

/// A banner is only worth anything when nobody is looking at the reason for it.
/// With the window in front, the row already says what happened.
fn show(app: &AppHandle, notices: Vec<Notice>) {
    if crate::app::windows::main_window(app).is_some_and(|window| {
        window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false)
    }) {
        return;
    }
    let (title, body) = compose(settings::stored_locale(app), notices);
    let _ = app.notification().builder().title(title).body(body).show();
}

fn notice(kind: Kind, project: String, execution: &Execution) -> Notice {
    let label = execution.label.clone();
    match kind {
        Kind::Failed => Notice::Failed {
            project,
            label,
            code: execution.exit_code,
        },
        Kind::Ready => Notice::Ready {
            project,
            label,
            port: execution.ports.first().map(|port| port.port).unwrap_or(0),
        },
        Kind::Done => Notice::Done {
            project,
            label,
            took_ms: took(execution),
        },
    }
}

fn took(execution: &Execution) -> i64 {
    execution
        .ended_at
        .map(|ended| ended - execution.started_at)
        .unwrap_or(0)
}

/// One notice reads as a sentence; several become a count and a short list,
/// failures first.
pub fn compose(locale: Locale, mut notices: Vec<Notice>) -> (String, String) {
    notices.sort_by_key(|notice| notice.kind() as u8);
    if let [notice] = notices.as_slice() {
        return (headline(locale, notice), context(locale, notice));
    }

    let kinds: HashSet<Kind> = notices.iter().map(Notice::kind).collect();
    let count = notices.len();
    let title = match (kinds.len(), notices[0].kind(), locale) {
        (1, Kind::Failed, Locale::Es) => format!("{count} comandos fallaron"),
        (1, Kind::Failed, Locale::En) => format!("{count} commands failed"),
        (1, Kind::Ready, Locale::Es) => format!("{count} servidores listos"),
        (1, Kind::Ready, Locale::En) => format!("{count} servers ready"),
        (1, Kind::Done, Locale::Es) => format!("{count} tareas terminaron"),
        (1, Kind::Done, Locale::En) => format!("{count} tasks finished"),
        (_, _, Locale::Es) => format!("Pulso · {count} avisos"),
        (_, _, Locale::En) => format!("Pulso · {count} updates"),
    };
    let mut lines: Vec<String> = notices
        .iter()
        .take(LINES)
        .map(|notice| format!("{} · {}", headline(locale, notice), project_of(notice)))
        .collect();
    if count > LINES {
        lines.push(match locale {
            Locale::Es => format!("y {} más", count - LINES),
            Locale::En => format!("and {} more", count - LINES),
        });
    }
    (title, lines.join("\n"))
}

fn headline(locale: Locale, notice: &Notice) -> String {
    match (notice, locale) {
        (Notice::Failed { label, .. }, Locale::Es) => format!("{label} falló"),
        (Notice::Failed { label, .. }, Locale::En) => format!("{label} failed"),
        (Notice::Ready { label, port, .. }, Locale::Es) => format!("{label} listo en :{port}"),
        (Notice::Ready { label, port, .. }, Locale::En) => format!("{label} ready on :{port}"),
        (Notice::Done { label, took_ms, .. }, Locale::Es) => {
            format!("{label} terminó en {}", duration(*took_ms))
        }
        (Notice::Done { label, took_ms, .. }, Locale::En) => {
            format!("{label} finished in {}", duration(*took_ms))
        }
    }
}

fn context(locale: Locale, notice: &Notice) -> String {
    match (notice, locale) {
        (Notice::Failed { project, code, .. }, Locale::Es) => {
            format!("{project} · código {}", code_text(*code))
        }
        (Notice::Failed { project, code, .. }, Locale::En) => {
            format!("{project} · exit code {}", code_text(*code))
        }
        _ => project_of(notice).to_string(),
    }
}

fn project_of(notice: &Notice) -> &str {
    match notice {
        Notice::Failed { project, .. }
        | Notice::Ready { project, .. }
        | Notice::Done { project, .. } => project,
    }
}

fn code_text(code: Option<i32>) -> String {
    code.map(|code| code.to_string())
        .unwrap_or_else(|| "—".to_string())
}

/// `45 s`, `2:14` or `1:02:09`, the way a stopwatch reads.
pub fn duration(ms: i64) -> String {
    let seconds = (ms / 1000).max(0);
    let (hours, minutes, seconds) = (seconds / 3600, seconds / 60 % 60, seconds % 60);
    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else if minutes > 0 {
        format!("{minutes}:{seconds:02}")
    } else {
        format!("{seconds} s")
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
