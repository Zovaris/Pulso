use std::process::{Command, Stdio};

use crate::app::cues::Cue;

const PLAYER: &str = "/usr/bin/afplay";
const SOUNDS: &str = "/System/Library/Sounds";

pub fn play(cue: Cue) {
    let _ = Command::new(PLAYER)
        .arg(format!("{SOUNDS}/{}.aiff", name(cue)))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

pub fn name(cue: Cue) -> &'static str {
    match cue {
        Cue::Start => "Tink",
        Cue::Success => "Glass",
        Cue::Failure => "Basso",
    }
}

#[cfg(test)]
mod tests;
