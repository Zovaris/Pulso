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
mod tests {
    use super::*;

    #[test]
    fn parses_nul_separated_entries_and_ignores_junk() {
        let bytes =
            b"PATH=/usr/bin:/bin\0HOME=/Users/example\0interactive shell banner\0=broken\09BAD=1\0";
        let environment = parse(bytes);

        assert_eq!(
            environment.get("PATH").map(String::as_str),
            Some("/usr/bin:/bin")
        );
        assert_eq!(
            environment.get("HOME").map(String::as_str),
            Some("/Users/example")
        );
        assert_eq!(environment.len(), 2);
    }

    #[test]
    fn the_shell_path_wins_and_the_inherited_one_still_contributes() {
        let from_shell = "/opt/homebrew/bin:/usr/bin".to_string();
        let inherited = "/usr/bin:/Users/example/.bun/bin".to_string();

        assert_eq!(
            merged_path(Some(&from_shell), Some(&inherited)),
            "/opt/homebrew/bin:/usr/bin:/Users/example/.bun/bin"
        );
    }

    #[test]
    fn an_unusable_path_falls_back_to_the_usual_places() {
        let empty = String::new();

        assert_eq!(merged_path(None, None), DEFAULT_PATH);
        assert_eq!(merged_path(Some(&empty), None), DEFAULT_PATH);
    }

    #[test]
    fn resolving_keeps_every_inherited_entry() {
        let inherited = std::env::var("PATH").unwrap_or_default();
        let environment = ShellEnvironment::new().for_dir(&std::env::temp_dir());
        let path = environment.get("PATH").cloned().unwrap_or_default();

        for entry in inherited.split(':').filter(|entry| !entry.is_empty()) {
            assert!(
                path.split(':').any(|candidate| candidate == entry),
                "{entry} was dropped from the resolved path"
            );
        }
    }
}
