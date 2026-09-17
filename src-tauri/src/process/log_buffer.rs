use std::collections::VecDeque;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use crate::domain::log::{LogLine, LogStream};
use crate::support::now_ms;

pub const DEFAULT_LINES: usize = 4000;

/// Room the text may take, as a multiple of the line cap: a log full of long
/// lines is cut by bytes before it is cut by lines.
const BYTES_PER_LINE: usize = 128;

struct Inner {
    lines: VecDeque<LogLine>,
    bytes: usize,
    next_seq: u64,
    pending: Vec<LogLine>,
}

pub struct LogBuffer {
    inner: Mutex<Inner>,
    limit: Arc<AtomicUsize>,
}

impl LogBuffer {
    /// The cap is shared rather than copied, so changing `logs.maxLines` in
    /// Ajustes reaches every buffer that is already running.
    pub fn new(limit: Arc<AtomicUsize>) -> Self {
        Self {
            inner: Mutex::new(Inner {
                lines: VecDeque::new(),
                bytes: 0,
                next_seq: 1,
                pending: Vec::new(),
            }),
            limit,
        }
    }

    fn capacity(&self) -> (usize, usize) {
        let lines = self.limit.load(Ordering::Relaxed).max(1);

        (lines, lines * BYTES_PER_LINE)
    }

    pub fn push(&self, stream: LogStream, raw: &str) {
        let text = clean(raw);
        if text.trim().is_empty() {
            return;
        }

        let Ok(mut inner) = self.inner.lock() else {
            return;
        };

        let line = LogLine {
            seq: inner.next_seq,
            at: now_ms(),
            stream,
            text,
        };

        inner.next_seq += 1;
        inner.bytes += line.text.len();
        inner.pending.push(line.clone());
        inner.lines.push_back(line);

        let (max_lines, max_bytes) = self.capacity();

        // The last line always stays, even when it alone is over the byte cap:
        // a single huge line is still output, and dropping it would leave a
        // buffer that silently keeps nothing.
        while inner.lines.len() > 1 && (inner.lines.len() > max_lines || inner.bytes > max_bytes) {
            let Some(dropped) = inner.lines.pop_front() else {
                break;
            };
            inner.bytes = inner.bytes.saturating_sub(dropped.text.len());
        }
    }

    pub fn take_pending(&self) -> Vec<LogLine> {
        let Ok(mut inner) = self.inner.lock() else {
            return Vec::new();
        };

        std::mem::take(&mut inner.pending)
    }

    pub fn tail(&self, limit: usize) -> Vec<LogLine> {
        let Ok(inner) = self.inner.lock() else {
            return Vec::new();
        };

        inner
            .lines
            .iter()
            .rev()
            .take(limit)
            .rev()
            .cloned()
            .collect()
    }

    pub fn after(&self, seq: u64, limit: usize) -> Vec<LogLine> {
        let Ok(inner) = self.inner.lock() else {
            return Vec::new();
        };

        inner
            .lines
            .iter()
            .filter(|line| line.seq > seq)
            .take(limit)
            .cloned()
            .collect()
    }
}

fn clean(raw: &str) -> String {
    let mut text = String::with_capacity(raw.len());
    let mut chars = raw.chars();

    while let Some(character) = chars.next() {
        if character == '\u{1b}' {
            match chars.next() {
                Some('[') => {
                    for byte in chars.by_ref() {
                        if ('\u{40}'..='\u{7e}').contains(&byte) {
                            break;
                        }
                    }
                }
                Some(']') => {
                    while let Some(byte) = chars.next() {
                        if byte == '\u{7}' {
                            break;
                        }
                        if byte == '\u{1b}' {
                            let _ = chars.next();
                            break;
                        }
                    }
                }
                Some(intermediate) if ('\u{20}'..='\u{2f}').contains(&intermediate) => {
                    for byte in chars.by_ref() {
                        if !('\u{20}'..='\u{2f}').contains(&byte) {
                            break;
                        }
                    }
                }
                _ => {}
            }
            continue;
        }

        if character == '\r' || character == '\t' {
            text.push(' ');
            continue;
        }

        if character.is_control() {
            continue;
        }

        text.push(character);
    }

    text.trim_end().to_string()
}

#[cfg(test)]
mod tests;
