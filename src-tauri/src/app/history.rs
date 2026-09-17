use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use crate::domain::execution::Execution;
use crate::domain::log::LogLine;
use crate::persistence::{repositories, Database};
use crate::support::error::Result;
use crate::support::now_ms;

pub struct ExecutionHistory {
    db: Arc<Database>,
    written: Mutex<HashSet<i64>>,
}

impl ExecutionHistory {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            written: Mutex::new(HashSet::new()),
        }
    }

    pub fn close_orphans(&self) -> usize {
        let at = now_ms();

        self.db
            .with(|conn| repositories::executions::close_orphans(conn, at))
            .unwrap_or(0)
    }

    pub fn observe(&self, execution: &Execution, tail: &[LogLine]) {
        if execution.is_active() {
            return;
        }

        let Ok(mut written) = self.written.lock() else {
            return;
        };

        if !written.insert(execution.id) {
            return;
        }

        if self.record(execution, tail).is_err() {
            written.remove(&execution.id);
        }
    }

    pub fn record(&self, execution: &Execution, tail: &[LogLine]) -> Result<i64> {
        self.db
            .with(|conn| repositories::executions::record(conn, execution, tail))
    }
}

#[cfg(test)]
mod tests;
