use std::path::PathBuf;
use std::process::{Command, Stdio};

pub const LABEL: &str = "com.justcallmebryan.pulso";

fn launch_agents() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;

    Some(PathBuf::from(home).join("Library/LaunchAgents"))
}

fn plist_path() -> Option<PathBuf> {
    Some(launch_agents()?.join(format!("{LABEL}.plist")))
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// A launch agent that starts the same binary at login. Written as a plist we
/// own, so turning it off again is a file we delete and nothing else.
pub fn plist(executable: &str, label: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \
         \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\">\n\
         <dict>\n\
         \t<key>Label</key>\n\
         \t<string>{label}</string>\n\
         \t<key>ProgramArguments</key>\n\
         \t<array>\n\
         \t\t<string>{executable}</string>\n\
         \t</array>\n\
         \t<key>RunAtLoad</key>\n\
         \t<true/>\n\
         \t<key>KeepAlive</key>\n\
         \t<false/>\n\
         </dict>\n\
         </plist>\n",
        label = escape(label),
        executable = escape(executable)
    )
}

/// Best effort on purpose: a login item that fails to register is not a reason
/// to refuse the rest of the preference write.
pub fn apply(should_run: bool) {
    let Some(path) = plist_path() else {
        return;
    };

    if should_run {
        let Ok(executable) = std::env::current_exe() else {
            return;
        };
        let Some(parent) = path.parent() else {
            return;
        };
        if std::fs::create_dir_all(parent).is_err() {
            return;
        }
        if std::fs::write(&path, plist(&executable.to_string_lossy(), LABEL)).is_err() {
            return;
        }

        run(&["bootstrap", &gui_domain(), &path.to_string_lossy()]);
        return;
    }

    if path.is_file() {
        run(&["bootout", &gui_domain(), &path.to_string_lossy()]);
        let _ = std::fs::remove_file(&path);
    }
}

fn gui_domain() -> String {
    format!("gui/{}", unsafe { libc::getuid() })
}

fn run(args: &[&str]) {
    let _ = Command::new("/bin/launchctl")
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(test)]
mod tests;
