use std::collections::VecDeque;
use std::sync::Mutex;

use crate::domain::log::{LogLine, LogStream};
use crate::support::now_ms;

const MAX_LINES: usize = 2000;
const MAX_BYTES: usize = 256 * 1024;

struct Inner {
    lines: VecDeque<LogLine>,
    bytes: usize,
    next_seq: u64,
    pending: Vec<LogLine>,
}

pub struct LogBuffer {
    inner: Mutex<Inner>,
}

impl Default for LogBuffer {
    fn default() -> Self {
        Self::new()
    }
}

impl LogBuffer {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                lines: VecDeque::new(),
                bytes: 0,
                next_seq: 1,
                pending: Vec::new(),
            }),
        }
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

        while inner.lines.len() > MAX_LINES || inner.bytes > MAX_BYTES {
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
mod tests {
    use super::*;

    #[test]
    fn colour_codes_and_carriage_returns_never_reach_the_ui() {
        let buffer = LogBuffer::new();
        buffer.push(LogStream::Stdout, "\u{1b}[32mready\u{1b}[0m\r");

        let lines = buffer.tail(10);
        assert_eq!(lines[0].text, "ready");
    }

    #[test]
    fn progress_bars_and_hyperlinks_leave_no_residue() {
        let buffer = LogBuffer::new();
        buffer.push(
            LogStream::Stdout,
            "\u{1b}[2K\u{1b}[1G 34% \u{1b}]8;;https://example.com\u{7}link\u{1b}]8;;\u{7} done",
        );

        let lines = buffer.tail(10);
        assert_eq!(lines[0].text, " 34% link done");
    }

    #[test]
    fn sequence_numbers_only_move_forward() {
        let buffer = LogBuffer::new();

        for index in 0..5 {
            buffer.push(LogStream::Stdout, &format!("line {index}"));
        }

        let lines = buffer.tail(10);
        assert_eq!(lines.len(), 5);
        assert_eq!(lines[0].seq, 1);
        assert_eq!(lines[4].seq, 5);
        assert_eq!(buffer.after(3, 10).len(), 2);
    }

    #[test]
    fn blank_lines_are_dropped() {
        let buffer = LogBuffer::new();
        buffer.push(LogStream::Stderr, "   ");

        assert!(buffer.tail(10).is_empty());
    }

    #[test]
    fn the_buffer_forgets_the_oldest_lines_first() {
        let buffer = LogBuffer::new();

        for index in 0..(MAX_LINES + 50) {
            buffer.push(LogStream::Stdout, &format!("line {index}"));
        }

        let lines = buffer.tail(MAX_LINES + 100);
        assert_eq!(lines.len(), MAX_LINES);
        assert_eq!(lines[0].text, "line 50");
    }

    #[test]
    fn taking_pending_empties_it() {
        let buffer = LogBuffer::new();
        buffer.push(LogStream::Stdout, "one");

        assert_eq!(buffer.take_pending().len(), 1);
        assert!(buffer.take_pending().is_empty());
        assert_eq!(buffer.tail(10).len(), 1);
    }
}
