use super::*;

#[test]
fn every_cue_points_at_a_sound_this_mac_has() {
    for cue in [Cue::Start, Cue::Success, Cue::Failure] {
        let path = format!("{SOUNDS}/{}.aiff", name(cue));

        assert!(
            std::path::Path::new(&path).exists(),
            "{path} is not on this machine"
        );
    }
}

#[test]
fn the_three_cues_are_three_different_sounds() {
    assert_ne!(name(Cue::Start), name(Cue::Success));
    assert_ne!(name(Cue::Success), name(Cue::Failure));
    assert_ne!(name(Cue::Failure), name(Cue::Start));
}
