use std::time::Duration;

use super::*;

#[test]
fn the_curve_holds_both_ends() {
    assert_eq!(ease(0.0), 0.0);
    assert_eq!(ease(1.0), 1.0);
    assert_eq!(ease(-1.0), 0.0);
    assert_eq!(ease(2.0), 1.0);
}

#[test]
fn the_curve_never_goes_backwards() {
    let mut previous = 0.0;

    for step in 0..=100 {
        let value = ease(f64::from(step) / 100.0);
        assert!(value >= previous, "{value} came after {previous}");
        assert!((0.0..=1.0).contains(&value));
        previous = value;
    }
}

#[test]
fn the_curve_spends_itself_early() {
    assert!(ease(0.2) > 0.7);
    assert!(ease(0.5) > 0.9);
}

#[test]
fn the_frames_end_exactly_at_the_target() {
    let frames = progressions(Duration::from_millis(160), Duration::from_millis(8));

    assert_eq!(frames.len(), 20);
    assert_eq!(frames.last(), Some(&1.0));
    assert!(frames.iter().all(|value| (0.0..=1.0).contains(value)));
    assert!(frames[0] < frames[1]);
}

#[test]
fn the_frames_fill_the_time_they_are_given() {
    assert_eq!(
        progressions(Duration::from_millis(120), Duration::from_millis(8)).len(),
        15
    );
    assert_eq!(
        progressions(Duration::from_millis(5), Duration::from_millis(8)),
        vec![1.0]
    );
    assert_eq!(
        progressions(Duration::ZERO, Duration::from_millis(8)),
        vec![1.0]
    );
    assert_eq!(
        progressions(Duration::from_millis(160), Duration::ZERO),
        vec![1.0]
    );
}

#[test]
fn a_new_slide_leaves_the_old_one_behind() {
    let generation = Generation::new();
    let first = generation.begin();
    assert!(generation.is_current(first));

    let second = generation.begin();
    assert!(!generation.is_current(first));
    assert!(generation.is_current(second));
}
