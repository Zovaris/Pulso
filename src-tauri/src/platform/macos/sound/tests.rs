use super::*;

fn sound(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("sounds")
        .join(format!("{name}.wav"))
}

#[test]
fn every_cue_has_a_sound_the_system_can_load() {
    for cue in [crate::app::cues::Cue::Done, crate::app::cues::Cue::Failure] {
        let path = sound(cue.sound());

        assert!(register(&path).is_some(), "{} did not load", path.display());
    }
}

#[test]
fn a_missing_file_is_skipped_instead_of_playing_silence() {
    assert!(register(&sound("nowhere")).is_none());
}
