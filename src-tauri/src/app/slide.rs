use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

pub const DISTANCE: f64 = 8.0;
pub const STEP: Duration = Duration::from_millis(8);
pub const ENTER: Duration = Duration::from_millis(160);
pub const EXIT: Duration = Duration::from_millis(120);

const CONTROL_X1: f64 = 0.16;
const CONTROL_X2: f64 = 0.3;

pub fn between(from: f64, to: f64, progress: f64) -> f64 {
    from + (to - from) * progress
}

pub fn ease(x: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    if x >= 1.0 {
        return 1.0;
    }

    let mut low = 0.0;
    let mut high = 1.0;

    for _ in 0..32 {
        let middle = (low + high) / 2.0;
        if curve(CONTROL_X1, CONTROL_X2, middle) < x {
            low = middle;
        } else {
            high = middle;
        }
    }

    curve(1.0, 1.0, (low + high) / 2.0)
}

fn curve(first: f64, second: f64, t: f64) -> f64 {
    let inverse = 1.0 - t;
    let a = 3.0 * inverse * inverse * t;
    let b = 3.0 * inverse * t * t;
    let c = t * t * t;

    a * first + b * second + c
}

pub fn progressions(duration: Duration, step: Duration) -> Vec<f64> {
    let total = duration.as_nanos();
    let tick = step.as_nanos();

    if total == 0 || tick == 0 {
        return vec![1.0];
    }

    let count = total.div_ceil(tick);

    (1..=count)
        .map(|index| {
            let travelled = (index * tick).min(total);
            ease(travelled as f64 / total as f64)
        })
        .collect()
}

pub struct Generation(AtomicU64);

impl Generation {
    pub const fn new() -> Self {
        Self(AtomicU64::new(0))
    }

    pub fn begin(&self) -> u64 {
        self.0.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn is_current(&self, generation: u64) -> bool {
        self.0.load(Ordering::SeqCst) == generation
    }
}

#[cfg(test)]
mod tests;
