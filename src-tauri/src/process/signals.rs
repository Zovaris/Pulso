use std::io;

pub const TERMINATE: i32 = libc::SIGTERM;
pub const KILL: i32 = libc::SIGKILL;

pub fn signal_group(pgid: i32, signal: i32) -> io::Result<()> {
    let result = unsafe { libc::killpg(pgid, signal) };
    if result == 0 {
        return Ok(());
    }

    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        return Ok(());
    }

    Err(error)
}

pub fn group_exists(pgid: i32) -> bool {
    pgid > 0 && unsafe { libc::killpg(pgid, 0) == 0 }
}
