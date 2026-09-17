use super::*;

fn probe_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "pulso-env-{name}-{}-{:?}",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    std::fs::create_dir_all(&dir).expect("the probe folder is created");

    dir
}

#[test]
fn the_path_is_split_into_entries() {
    let empty = report("/bin/zsh".to_string(), "".to_string(), &[]);
    assert!(empty.entries.is_empty());

    let single = report("/bin/zsh".to_string(), "/bin".to_string(), &[]);
    assert_eq!(single.entries.len(), 1);
    assert_eq!(single.entries[0].dir, "/bin");
    assert!(single.entries[0].exists);

    let padded = report("/bin/zsh".to_string(), ":/bin::/nope:".to_string(), &[]);
    assert_eq!(padded.entries.len(), 2);
    assert!(!padded.entries[1].exists);
}

#[test]
fn the_shell_is_reported_as_given() {
    assert_eq!(
        report("/bin/bash".to_string(), String::new(), &[]).shell,
        "/bin/bash"
    );
}

#[test]
fn a_program_on_the_path_is_found_with_its_folder() {
    let dir = probe_dir("found");
    let program = dir.join("pulso-probe");
    std::fs::write(&program, b"#!/bin/sh\n").unwrap();
    std::fs::set_permissions(
        &program,
        std::os::unix::fs::PermissionsExt::from_mode(0o755),
    )
    .unwrap();

    let report = report(
        "/bin/zsh".to_string(),
        format!("{}:/bin", dir.to_string_lossy()),
        &["pulso-probe".to_string()],
    );

    assert_eq!(
        report.programs[0].path.as_deref(),
        Some(program.to_string_lossy().as_ref())
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_program_that_is_not_there_reads_as_missing() {
    let found = report(
        "/bin/zsh".to_string(),
        "/bin".to_string(),
        &["pulso-definitely-not-a-program".to_string()],
    );

    assert_eq!(found.programs[0].name, "pulso-definitely-not-a-program");
    assert_eq!(found.programs[0].path, None);
}

#[test]
fn a_file_that_is_not_executable_does_not_count() {
    let dir = probe_dir("not-executable");
    let program = dir.join("pulso-not-exec");
    std::fs::write(&program, b"plain\n").unwrap();
    std::fs::set_permissions(
        &program,
        std::os::unix::fs::PermissionsExt::from_mode(0o644),
    )
    .unwrap();

    let report = report(
        "/bin/zsh".to_string(),
        dir.to_string_lossy().into_owned(),
        &["pulso-not-exec".to_string()],
    );

    assert_eq!(report.programs[0].path, None);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn the_report_reaches_the_frontend_the_way_it_reads_it() {
    let json = serde_json::to_value(report(
        "/bin/zsh".to_string(),
        "/bin".to_string(),
        &["bun".to_string()],
    ))
    .expect("the report should serialize");

    assert_eq!(json["shell"], "/bin/zsh");
    assert_eq!(json["entries"][0]["dir"], "/bin");
    assert_eq!(json["programs"][0]["name"], "bun");
}
