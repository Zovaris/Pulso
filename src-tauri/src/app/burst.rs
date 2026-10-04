use std::sync::Mutex;
use std::time::Duration;

/// Things that arrive together and should be answered once: a group that
/// starts five commands, or three tests failing in the same second.
pub struct Burst<T> {
    items: Vec<T>,
}

impl<T> Default for Burst<T> {
    fn default() -> Self {
        Self { items: Vec::new() }
    }
}

impl<T> Burst<T> {
    /// True for the first item of a burst: the caller schedules the answer then.
    pub fn push(&mut self, item: T) -> bool {
        self.items.push(item);
        self.items.len() == 1
    }

    pub fn take(&mut self) -> Vec<T> {
        std::mem::take(&mut self.items)
    }
}

/// Collects `item` and, when it opens a burst, answers the whole burst once
/// `window` has passed, without blocking the caller. Only the `answer` given
/// with the first item runs, so every caller of one burst passes the same one.
pub fn gather<T: Send + 'static>(
    burst: &'static Mutex<Option<Burst<T>>>,
    item: T,
    window: Duration,
    answer: impl FnOnce(Vec<T>) + Send + 'static,
) {
    let Ok(mut guard) = burst.lock() else {
        return;
    };
    if !guard.get_or_insert_with(Burst::default).push(item) {
        return;
    }
    drop(guard);
    std::thread::spawn(move || {
        std::thread::sleep(window);
        let items = burst
            .lock()
            .ok()
            .and_then(|mut guard| guard.as_mut().map(Burst::take))
            .unwrap_or_default();
        if !items.is_empty() {
            answer(items);
        }
    });
}

#[cfg(test)]
mod tests;
