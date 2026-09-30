use super::*;
use std::os::unix::fs::PermissionsExt;
use std::sync::Mutex;

static SHELL_GUARD: Mutex<()> = Mutex::new(());

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
    let _guard = SHELL_GUARD.lock().unwrap();
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

#[test]
fn a_hanging_shell_is_reaped_on_timeout() {
    let _guard = SHELL_GUARD.lock().unwrap();
    let dir = std::env::temp_dir().join(format!(
        "pulso-hang-{}-{:?}",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    std::fs::create_dir_all(&dir).expect("the fixture dir exists");

    let script = dir.join("hang.sh");
    std::fs::write(
        &script,
        format!(
            "#!/bin/sh\necho $$ > \"{}/pid\"\nexec /bin/sleep 30\n",
            dir.to_string_lossy()
        ),
    )
    .expect("the fixture script exists");
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))
        .expect("the fixture script runs");

    let previous = std::env::var("SHELL").ok();
    std::env::set_var("SHELL", &script);
    let resolved = resolve(&std::env::temp_dir());
    match previous {
        Some(value) => std::env::set_var("SHELL", value),
        None => std::env::remove_var("SHELL"),
    }

    assert!(resolved.is_none());

    let pid: i32 = std::fs::read_to_string(dir.join("pid"))
        .expect("the shell wrote its pid")
        .trim()
        .parse()
        .expect("the pid parses");

    let mut gone = false;
    for _ in 0..50 {
        if unsafe { libc::kill(pid, 0) } != 0 {
            gone = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(20));
    }

    let _ = std::fs::remove_dir_all(&dir);
    assert!(gone, "the hanging shell was left behind");
}
