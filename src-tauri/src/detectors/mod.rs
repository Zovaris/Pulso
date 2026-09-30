pub mod cargo_toml;
pub mod compose;
pub mod composer_json;
pub mod deno_json;
pub mod justfile;
pub mod makefile;
pub mod naming;
pub mod package_json;
pub mod procfile;
pub mod taskfile;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime};

use yaml_rust2::Yaml;

use crate::domain::command::{CommandScan, DetectedCommand, ScanStatus};

#[derive(Debug, Clone)]
pub enum DetectError {
    Missing,
    Unreadable(String),
    Invalid(String),
}

pub trait CommandDetector {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn detect(&self, project_dir: &Path) -> std::result::Result<Vec<DetectedCommand>, DetectError>;
}

pub fn detectors() -> [&'static dyn CommandDetector; 9] {
    [
        &package_json::PackageJsonDetector,
        &deno_json::DenoJsonDetector,
        &composer_json::ComposerJsonDetector,
        &makefile::MakefileDetector,
        &justfile::JustfileDetector,
        &taskfile::TaskfileDetector,
        &compose::ComposeDetector,
        &cargo_toml::CargoTomlDetector,
        &procfile::ProcfileDetector,
    ]
}

pub fn manifest(project_dir: &Path, names: &[&str]) -> Option<PathBuf> {
    names
        .iter()
        .map(|name| project_dir.join(name))
        .find(|candidate| candidate.is_file())
}

pub fn declared_keys<'a>(document: &'a [Yaml], key: &str) -> Vec<&'a str> {
    let Some(section) = document.first().and_then(|root| root[key].as_hash()) else {
        return Vec::new();
    };

    section
        .keys()
        .filter_map(Yaml::as_str)
        .filter(|name| !name.starts_with('_'))
        .collect()
}

type Fingerprint = Vec<Option<(u64, SystemTime)>>;

struct CachedScan {
    at: Instant,
    fingerprint: Fingerprint,
    scan: CommandScan,
}

const SCAN_TTL: Duration = Duration::from_secs(30);
const SCAN_FILES: &[&str] = &[
    "package.json",
    "deno.json",
    "deno.jsonc",
    "composer.json",
    "Makefile",
    "makefile",
    "GNUmakefile",
    "justfile",
    "Justfile",
    ".justfile",
    "Taskfile.yml",
    "Taskfile.yaml",
    "taskfile.yml",
    "taskfile.yaml",
    "compose.yml",
    "compose.yaml",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Cargo.toml",
    "Procfile",
    "bun.lock",
    "bun.lockb",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
];

fn fingerprint(dir: &Path) -> Fingerprint {
    SCAN_FILES
        .iter()
        .map(|name| {
            let metadata = std::fs::metadata(dir.join(name)).ok()?;
            Some((metadata.len(), metadata.modified().ok()?))
        })
        .collect()
}

pub fn scan_cached(project_id: i64, project_dir: &Path) -> CommandScan {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, CachedScan>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let stamp = fingerprint(project_dir);
    if project_dir.is_dir() {
        if let Ok(held) = cache.lock() {
            if let Some(cached) = held
                .get(project_dir)
                .filter(|cached| cached.at.elapsed() < SCAN_TTL && cached.fingerprint == stamp)
            {
                let mut scan = cached.scan.clone();
                scan.project_id = project_id;
                return scan;
            }
        }
    }
    let scan = scan(project_id, project_dir);
    if fingerprint(project_dir) == stamp {
        if let Ok(mut held) = cache.lock() {
            held.retain(|_, cached| cached.at.elapsed() < SCAN_TTL);
            if held.len() >= 128 {
                if let Some(oldest) = held
                    .iter()
                    .min_by_key(|(_, cached)| cached.at)
                    .map(|(path, _)| path.clone())
                {
                    held.remove(&oldest);
                }
            }
            held.insert(
                project_dir.to_path_buf(),
                CachedScan {
                    at: Instant::now(),
                    fingerprint: stamp,
                    scan: scan.clone(),
                },
            );
        }
    }
    scan
}

pub fn scan(project_id: i64, project_dir: &Path) -> CommandScan {
    if !project_dir.is_dir() {
        return CommandScan::new(
            project_id,
            ScanStatus::Unavailable,
            Some("The project folder is not there.".to_string()),
        );
    }

    let mut commands: Vec<DetectedCommand> = Vec::new();
    let mut silent: Vec<&str> = Vec::new();
    let mut invalid: Vec<String> = Vec::new();
    let mut unreadable: Vec<String> = Vec::new();

    for detector in detectors() {
        match detector.detect(project_dir) {
            Ok(found) if found.is_empty() => silent.push(detector.label()),
            Ok(found) => commands.extend(found),
            Err(DetectError::Missing) => {}
            Err(DetectError::Invalid(detail)) => invalid.push(detail),
            Err(DetectError::Unreadable(detail)) => unreadable.push(detail),
        }
    }

    if !commands.is_empty() {
        naming::sort_commands(&mut commands);
        return CommandScan::detected(project_id, commands);
    }

    if !invalid.is_empty() {
        return CommandScan::new(
            project_id,
            ScanStatus::InvalidManifest,
            Some(invalid.join(" ")),
        );
    }

    if !unreadable.is_empty() {
        return CommandScan::new(
            project_id,
            ScanStatus::Unreadable,
            Some(unreadable.join(" ")),
        );
    }

    if !silent.is_empty() {
        return CommandScan::new(project_id, ScanStatus::NoCommands, Some(silent.join(", ")));
    }

    let looked_for: Vec<&str> = detectors()
        .iter()
        .map(|detector| detector.label())
        .collect();

    CommandScan::new(
        project_id,
        ScanStatus::NoManifest,
        Some(looked_for.join(", ")),
    )
}

#[cfg(test)]
mod tests;
