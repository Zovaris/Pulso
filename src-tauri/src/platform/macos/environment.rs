use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;

const RESOLUTION_TIMEOUT: Duration = Duration::from_secs(5);
const DEFAULT_PATH: &str = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

pub struct ShellEnvironment {
    cache: Mutex<HashMap<PathBuf, HashMap<String, String>>>,
}

impl Default for ShellEnvironment {
    fn default() -> Self {
        Self::new()
    }
}

impl ShellEnvironment {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn for_dir(&self, dir: &Path) -> HashMap<String, String> {
        if let Some(cached) = self.cached(dir) {
            return cached;
        }

        let inherited: HashMap<String, String> = std::env::vars().collect();
        let Some(from_shell) = resolve(dir) else {
            let mut fallback = inherited;
            fallback.insert("PATH".to_string(), merged_path(None, None));
            return fallback;
        };

        let path = merged_path(from_shell.get("PATH"), inherited.get("PATH"));
        let mut environment = inherited;
        environment.extend(from_shell);
        environment.insert("PATH".to_string(), path);
        environment
            .entry("TERM".to_string())
            .or_insert_with(|| "xterm-256color".to_string());

        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(dir.to_path_buf(), environment.clone());
        }

        environment
    }

    fn cached(&self, dir: &Path) -> Option<HashMap<String, String>> {
        self.cache.lock().ok()?.get(dir).cloned()
    }
}

/// Where a program really resolves, walking the `PATH` in order. A program with
/// a slash in it is taken as a path and not searched for.
pub fn which(program: &str, path: &str) -> Option<String> {
    if program.contains('/') {
        let candidate = Path::new(program);

        return is_executable(candidate).then(|| program.to_string());
    }

    path.split(':')
        .filter(|dir| !dir.is_empty())
        .map(|dir| Path::new(dir).join(program))
        .find(|candidate| is_executable(candidate))
        .map(|candidate| candidate.to_string_lossy().into_owned())
}

fn is_executable(path: &Path) -> bool {
    let Ok(raw) = std::ffi::CString::new(path.as_os_str().as_encoded_bytes()) else {
        return false;
    };

    unsafe { libc::access(raw.as_ptr(), libc::X_OK) == 0 }
}

fn resolve(dir: &Path) -> Option<HashMap<String, String>> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut command = Command::new(shell);
    command.args(["-lic", "env -0"]);
    command.current_dir(dir);
    command.stdin(Stdio::null());
    command.stderr(Stdio::null());
    command.stdout(Stdio::piped());

    let mut child = command.spawn().ok()?;
    let mut stdout = child.stdout.take()?;

    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stdout.read_to_end(&mut bytes);
        let _ = sender.send(bytes);
    });

    let bytes = receiver.recv_timeout(RESOLUTION_TIMEOUT).ok()?;
    let _ = child.kill();
    let _ = child.wait();

    let environment = parse(&bytes);
    environment.contains_key("PATH").then_some(environment)
}

fn parse(bytes: &[u8]) -> HashMap<String, String> {
    bytes
        .split(|byte| *byte == 0)
        .filter_map(|entry| {
            let entry = String::from_utf8_lossy(entry);
            let (key, value) = entry.split_once('=')?;
            let named = !key.is_empty()
                && !key.starts_with(|character: char| character.is_ascii_digit())
                && key
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '_');
            named.then(|| (key.to_string(), value.to_string()))
        })
        .collect()
}

fn merged_path(from_shell: Option<&String>, inherited: Option<&String>) -> String {
    let mut entries: Vec<&str> = Vec::new();
    for source in [from_shell, inherited].into_iter().flatten() {
        for entry in source.split(':') {
            let entry = entry.trim();
            if !entry.is_empty() && !entries.contains(&entry) {
                entries.push(entry);
            }
        }
    }

    if entries.is_empty() {
        return DEFAULT_PATH.to_string();
    }

    entries.join(":")
}

#[cfg(test)]
mod tests;
