use super::*;
use std::os::unix::fs::PermissionsExt;

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

#[test]
fn the_environment_cache_expires() {
    let resolver = ShellEnvironment::new();
    let dir = std::env::temp_dir();
    resolver.cache.lock().unwrap().insert(
        dir.clone(),
        CachedEnvironment {
            at: Instant::now() - CACHE_TTL,
            values: HashMap::from([("PATH".to_string(), "/stale".to_string())]),
        },
    );
    assert!(resolver.cached(&dir).is_none());
}

fn fixture(name: &str, body: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "pulso-{name}-{}-{:?}",
        crate::support::now_ms(),
        std::thread::current().id()
    ));
    std::fs::create_dir_all(&dir).expect("the fixture dir exists");

    let script = dir.join("shell.sh");
    std::fs::write(&script, body).expect("the fixture script exists");
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))
        .expect("the fixture script runs");

    script
}

#[test]
fn a_stray_child_holding_the_pipe_does_not_delay_the_resolve() {
    let script = fixture("stray", "#!/bin/sh\n( /bin/sleep 30 ) &\nenv -0\n");
    let started = Instant::now();

    let resolved = resolve_with_shell(&std::env::temp_dir(), &script, RESOLUTION_TIMEOUT);

    let elapsed = started.elapsed();
    let _ = std::fs::remove_dir_all(script.parent().expect("the fixture dir"));
    assert!(
        elapsed < Duration::from_secs(2),
        "the resolve waited {elapsed:?} on a stray child"
    );
    assert!(
        resolved.is_some_and(|environment| environment.contains_key("PATH")),
        "the environment was dropped because a stray child held the pipe"
    );
}

#[test]
fn a_shell_that_prints_and_then_hangs_still_resolves() {
    let script = fixture("lingering", "#!/bin/sh\nenv -0\n/bin/sleep 30\n");
    let started = Instant::now();

    let resolved = resolve_with_shell(&std::env::temp_dir(), &script, RESOLUTION_TIMEOUT);

    let elapsed = started.elapsed();
    let _ = std::fs::remove_dir_all(script.parent().expect("the fixture dir"));
    assert!(
        elapsed < Duration::from_secs(2),
        "the resolve waited {elapsed:?} on a shell that never exits"
    );
    assert!(
        resolved.is_some_and(|environment| environment.contains_key("PATH")),
        "the environment `env` printed was thrown away"
    );
}

#[test]
fn the_resolve_shell_leaves_the_session_of_the_launching_terminal() {
    let mut command = Command::new("/bin/sh");
    command.args(["-c", "/bin/sleep 30"]);
    command.stdin(Stdio::null());
    detach(&mut command);

    let mut child = command.spawn().expect("the probe shell starts");
    let pid = child.id() as i32;
    let session = unsafe { libc::getsid(pid) };

    let _ = crate::process::signals::signal_group(pid, libc::SIGKILL);
    let _ = child.wait();

    assert_eq!(
        session, pid,
        "the resolve shell stayed in the session of the terminal that launched the app, where taking that terminal stops it with SIGTTOU before it prints anything"
    );
}

#[test]
fn a_hanging_shell_is_reaped_on_timeout() {
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

    let resolved = resolve_with_shell(&std::env::temp_dir(), &script, Duration::from_millis(250));

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
