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
