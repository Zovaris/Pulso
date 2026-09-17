use std::collections::HashMap;
use std::sync::Mutex;

use tauri::AppHandle;

use crate::commands::settings::sound_cues;
use crate::domain::execution::{Execution, ExecutionState};
use crate::platform::macos::sound;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cue {
    Start,
    Success,
    Failure,
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

        cue_for(previous, execution.state)
    }
}

static TRACKER: Mutex<Option<Tracker>> = Mutex::new(None);

pub fn observe(app: &AppHandle, execution: &Execution) {
    let Ok(mut guard) = TRACKER.lock() else {
        return;
    };
    let tracker = guard.get_or_insert_with(Tracker::default);

    let Some(cue) = tracker.observe(execution) else {
        return;
    };

    if sound_cues(app) {
        sound::play(cue);
    }
}

fn cue_for(previous: Option<ExecutionState>, next: ExecutionState) -> Option<Cue> {
    match next {
        ExecutionState::Starting => (previous.is_none()).then_some(Cue::Start),
        ExecutionState::Failed => Some(Cue::Failure),
        ExecutionState::Exited => {
            (previous != Some(ExecutionState::Stopping)).then_some(Cue::Success)
        }
        ExecutionState::Running | ExecutionState::Stopping | ExecutionState::Interrupted => None,
    }
}

#[cfg(test)]
mod tests;
