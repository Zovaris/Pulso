use std::path::Path;

/// Plays a short cue through whatever the OS uses for alert sounds. Each
/// platform answers it in its own module; one without an answer stays quiet.
pub fn play(file: &Path) {
    #[cfg(target_os = "macos")]
    super::macos::sound::play(file);

    #[cfg(not(target_os = "macos"))]
    let _ = file;
}
