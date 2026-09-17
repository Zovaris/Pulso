use std::path::{Path, PathBuf};

use super::*;

struct Sandbox {
    root: PathBuf,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!("pulso-legacy-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("sandbox");
        Self { root }
    }

    fn data_dir(&self) -> PathBuf {
        self.root.join("com.sthbryan.pulso")
    }

    fn legacy_dir(&self) -> PathBuf {
        self.root.join(LEGACY_BUNDLE_ID)
    }

    fn write_legacy(&self, name: &str, body: &[u8]) {
        let dir = self.legacy_dir();
        std::fs::create_dir_all(&dir).expect("legacy dir");
        std::fs::write(dir.join(name), body).expect("legacy file");
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn read(path: &Path) -> Vec<u8> {
    std::fs::read(path).expect("read")
}

#[test]
fn carries_the_previous_database_over() {
    let sandbox = Sandbox::new("carry");
    sandbox.write_legacy(LEGACY_DATABASE, b"projects");

    adopt_legacy_database(&sandbox.data_dir()).expect("adopt");

    assert_eq!(read(&database_path(&sandbox.data_dir())), b"projects");
}

#[test]
fn carries_the_write_ahead_log_over() {
    let sandbox = Sandbox::new("wal");
    sandbox.write_legacy(LEGACY_DATABASE, b"projects");
    sandbox.write_legacy("soffy.db-wal", b"pending");

    adopt_legacy_database(&sandbox.data_dir()).expect("adopt");

    assert_eq!(
        read(&sandbox.data_dir().join("pulso.db-wal")),
        b"pending".to_vec()
    );
    assert!(!sandbox.data_dir().join("pulso.db-shm").exists());
}

#[test]
fn leaves_an_existing_database_alone() {
    let sandbox = Sandbox::new("occupied");
    sandbox.write_legacy(LEGACY_DATABASE, b"previous");
    std::fs::create_dir_all(sandbox.data_dir()).expect("data dir");
    std::fs::write(database_path(&sandbox.data_dir()), b"current").expect("current");

    adopt_legacy_database(&sandbox.data_dir()).expect("adopt");

    assert_eq!(read(&database_path(&sandbox.data_dir())), b"current");
}

#[test]
fn does_nothing_without_previous_data() {
    let sandbox = Sandbox::new("fresh");

    adopt_legacy_database(&sandbox.data_dir()).expect("adopt");

    assert!(!sandbox.data_dir().exists());
}
