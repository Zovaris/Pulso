use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};

use tauri::{AppHandle, Emitter};

use crate::domain::execution::{Execution, ExecutionState};
use crate::support::now_ms;

pub const FAILURES_SEEN: &str = "failures://seen";

/// When the user last looked at what failed. One mark for the whole app, so
/// opening Procesos in the window also clears the menu bar.
static SEEN_AT: AtomicI64 = AtomicI64::new(0);

/// Failures from before launch were already there when the user opened Pulso.
pub fn start() {
    SEEN_AT.store(now_ms(), Ordering::Relaxed);
}

pub fn seen_at() -> i64 {
    SEEN_AT.load(Ordering::Relaxed)
}

pub fn mark_seen(app: &AppHandle) -> i64 {
    let now = now_ms();
    SEEN_AT.store(now, Ordering::Relaxed);
    let _ = app.emit(FAILURES_SEEN, now);
    crate::app::tray::sync(app);
    now
}

/// Commands whose latest run failed after `seen_at`. A failure that was run
/// again since is no longer waiting for anyone.
pub fn unseen(executions: &[Execution], seen_at: i64) -> usize {
    let mut latest: HashMap<(i64, &str), &Execution> = HashMap::new();
    for execution in executions {
        let key = (execution.project_id, execution.command_id.as_str());
        if latest
            .get(&key)
            .is_none_or(|known| known.started_at <= execution.started_at)
        {
            latest.insert(key, execution);
        }
    }
    latest
        .values()
        .filter(|execution| {
            execution.state == ExecutionState::Failed && execution.ended_at.unwrap_or(0) > seen_at
        })
        .count()
}

#[cfg(test)]
mod tests;
