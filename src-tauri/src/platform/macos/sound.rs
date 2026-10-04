use std::collections::HashMap;
use std::ffi::c_void;
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

type SystemSoundId = u32;

#[link(name = "AudioToolbox", kind = "framework")]
extern "C" {
    fn AudioServicesCreateSystemSoundID(url: *const c_void, sound: *mut SystemSoundId) -> i32;
    fn AudioServicesPlayAlertSound(sound: SystemSoundId);
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFURLCreateFromFileSystemRepresentation(
        allocator: *const c_void,
        buffer: *const u8,
        length: isize,
        is_directory: u8,
    ) -> *const c_void;
    fn CFRelease(object: *const c_void);
}

static LOADED: Mutex<Option<HashMap<PathBuf, SystemSoundId>>> = Mutex::new(None);

/// An alert sound, unlike a plain one, goes to the device chosen for sound
/// effects and plays at the alert volume, both of which the user set.
pub fn play(file: &Path) {
    if let Some(sound) = loaded(file) {
        unsafe { AudioServicesPlayAlertSound(sound) };
    }
}

fn loaded(file: &Path) -> Option<SystemSoundId> {
    let mut guard = LOADED.lock().ok()?;
    let sounds = guard.get_or_insert_with(HashMap::new);
    if let Some(sound) = sounds.get(file) {
        return Some(*sound);
    }
    let sound = register(file)?;
    sounds.insert(file.to_path_buf(), sound);
    Some(sound)
}

fn register(file: &Path) -> Option<SystemSoundId> {
    if !file.is_file() {
        return None;
    }
    let bytes = file.as_os_str().as_bytes();
    let url = unsafe {
        CFURLCreateFromFileSystemRepresentation(
            std::ptr::null(),
            bytes.as_ptr(),
            bytes.len() as isize,
            0,
        )
    };
    if url.is_null() {
        return None;
    }
    let mut sound: SystemSoundId = 0;
    let status = unsafe { AudioServicesCreateSystemSoundID(url, &mut sound) };
    unsafe { CFRelease(url) };
    (status == 0).then_some(sound)
}

#[cfg(test)]
mod tests;
