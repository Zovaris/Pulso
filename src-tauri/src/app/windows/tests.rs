use super::slide;
use super::*;

fn at(x: i32, y: i32) -> PhysicalPosition<i32> {
    PhysicalPosition::new(x, y)
}

#[test]
fn entering_starts_invisible_and_a_slide_higher() {
    let motion = Motion::entering(at(0, 100), at(0, 108));

    assert_eq!(motion.position(0.0), at(0, 100));
    assert_eq!(motion.alpha(0.0), 0.0);
    assert_eq!(motion.position(1.0), at(0, 108));
    assert_eq!(motion.alpha(1.0), 1.0);
    assert_eq!(motion.duration, slide::ENTER);
}

#[test]
fn leaving_ends_invisible_where_it_went() {
    let motion = Motion::leaving(at(0, 108), at(0, 100));

    assert_eq!(motion.alpha(0.0), 1.0);
    assert_eq!(motion.alpha(1.0), 0.0);
    assert_eq!(motion.position(1.0), at(0, 100));
    assert_eq!(motion.duration, slide::EXIT);
}

#[test]
fn both_endpoints_move_together() {
    let motion = Motion::entering(at(40, 100), at(40, 108));

    for step in 0..=10 {
        let progress = f64::from(step) / 10.0;
        let expected = 100 + (8.0 * progress).round() as i32;

        assert_eq!(motion.position(progress).y, expected);
        assert_eq!(motion.alpha(progress), progress);
    }
}

#[test]
fn resting_takes_no_time_and_stays_put() {
    let motion = Motion::resting(at(12, 34));

    assert!(motion.duration.is_zero());
    assert_eq!(motion.position(0.0), at(12, 34));
    assert_eq!(motion.position(0.5), at(12, 34));
    assert_eq!(motion.position(1.0), at(12, 34));
    assert_eq!(motion.alpha(0.0), 1.0);
    assert_eq!(motion.alpha(1.0), 1.0);
}

#[test]
fn the_system_can_ask_for_stillness() {
    set_reduced_motion(true);
    assert!(reduced_motion());

    set_reduced_motion(false);
    assert!(!reduced_motion());
}
