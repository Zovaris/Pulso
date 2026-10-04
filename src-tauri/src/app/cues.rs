use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::app::burst::{self, Burst};
use crate::commands::settings::sound_cues;
use crate::domain::execution::{Execution, ExecutionState};
use crate::platform;

/// A run shorter than this finished while the user was still looking at it,
/// so a sound would only repeat what the row already says.
pub const LONG_RUN_MS: i64 = 20_000;

/// Long enough to hear a group as one event, short enough to still feel live.
const BURST: Duration = Duration::from_millis(250);

/// Ordered by how much it matters: a burst with a failure in it sounds like one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Cue {
    Done,
    Failure,
}

impl Cue {
    pub fn sound(self) -> &'static str {
        match self {
            Cue::Done => "done",
            Cue::Failure => "failed",
        }
    }
}

#[derive(Default)]
pub struct Tracker {
    seen: HashMap<i64, ExecutionState>,
}

impl Tracker {
    pub fn observe(&mut self, execution: &Execution) -> Option<Cue> {
        let previous = self.seen.insert(execution.id, execution.state);
        if previous == Some(execution.state) {
            return None;
        }

        cue_for(previous, execution)
    }
}

static TRACKER: Mutex<Option<Tracker>> = Mutex::new(None);
static PENDING: Mutex<Option<Burst<Cue>>> = Mutex::new(None);

pub fn observe(app: &AppHandle, execution: &Execution) {
    let Some(cue) = TRACKER.lock().ok().and_then(|mut guard| {
        guard
            .get_or_insert_with(Tracker::default)
            .observe(execution)
    }) else {
        return;
    };
    if !sound_cues(app) {
        return;
    }

    let app = app.clone();
    burst::gather(&PENDING, cue, BURST, move |cues| {
        if let Some(cue) = loudest(&cues) {
            play(&app, cue);
        }
    });
}

pub fn loudest(cues: &[Cue]) -> Option<Cue> {
    cues.iter().copied().max()
}

fn play(app: &AppHandle, cue: Cue) {
    let Ok(path) = app.path().resolve(
        format!("sounds/{}.wav", cue.sound()),
        tauri::path::BaseDirectory::Resource,
    ) else {
        return;
    };
    platform::sound::play(&path);
}

fn cue_for(previous: Option<ExecutionState>, execution: &Execution) -> Option<Cue> {
    match execution.state {
        ExecutionState::Failed => Some(Cue::Failure),
        ExecutionState::Exited => {
            (previous != Some(ExecutionState::Stopping) && ran_long(execution)).then_some(Cue::Done)
        }
        _ => None,
    }
}

fn ran_long(execution: &Execution) -> bool {
    execution
        .ended_at
        .is_some_and(|ended| ended - execution.started_at >= LONG_RUN_MS)
}

#[cfg(test)]
mod tests;
