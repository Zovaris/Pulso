use super::*;

fn fixture(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("tests")
        .join("fixtures")
        .join(name)
}

#[test]
fn commands_from_every_manifest_land_in_one_scan() {
    let scan = scan(1, &fixture("mixed-project"));
    let labels: Vec<&str> = scan
        .commands
        .iter()
        .map(|command| command.label.as_str())
        .collect();

    assert_eq!(scan.status, ScanStatus::Detected);
    assert!(labels.contains(&"dev"));
    assert!(labels.contains(&"migrate"));
    assert!(labels.contains(&"web"));

    let detectors: Vec<&str> = scan
        .commands
        .iter()
        .map(|command| command.detector.as_str())
        .collect();
    assert!(detectors.contains(&"package_json"));
    assert!(detectors.contains(&"makefile"));
    assert!(detectors.contains(&"procfile"));
}

#[test]
fn the_whole_scan_keeps_the_running_commands_first() {
    let scan = scan(1, &fixture("mixed-project"));
    let ranks: Vec<u8> = scan
        .commands
        .iter()
        .map(|command| command.category.rank())
        .collect();

    assert!(ranks.windows(2).all(|pair| pair[0] <= pair[1]));
}

#[test]
fn a_folder_with_nothing_to_read_names_what_soffy_looks_for() {
    let scan = scan(2, &fixture("empty-project"));

    assert_eq!(scan.status, ScanStatus::NoManifest);
    assert!(scan.commands.is_empty());
    let detail = scan.detail.unwrap_or_default();
    for manifest in [
        "package.json",
        "Makefile",
        "justfile",
        "Procfile",
        "composer.json",
    ] {
        assert!(
            detail.contains(manifest),
            "{manifest} should be listed in {detail}"
        );
    }
}

#[test]
fn manifests_that_declare_nothing_are_named() {
    let scan = scan(2, &fixture("bare-project"));

    assert_eq!(scan.status, ScanStatus::NoCommands);
    let detail = scan.detail.unwrap_or_default();
    assert_eq!(detail, "package.json, deno.json, composer.json");
}

#[test]
fn a_broken_manifest_is_reported_even_when_another_one_works() {
    let scan = scan(2, &fixture("half-broken-project"));

    assert_eq!(scan.status, ScanStatus::Detected);
    assert!(!scan.commands.is_empty());
}

#[test]
fn a_folder_that_is_gone_is_unavailable() {
    let scan = scan(1, Path::new("/soffy/does/not/exist"));

    assert_eq!(scan.status, ScanStatus::Unavailable);
}
