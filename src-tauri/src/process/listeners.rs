use std::collections::BTreeMap;
use std::process::Stdio;
use std::time::Duration;

use crate::domain::port::{ListeningPort, PortTarget};
use crate::support::error::{BackendError, ErrorKind, Result};

/// `lsof` ships with macOS. Numeric output avoids DNS/service-name lookups;
/// machine fields avoid parsing columns or truncating process names.
pub async fn scan(groups: &[(i64, i32)]) -> Result<Vec<ListeningPort>> {
    let mut command = tokio::process::Command::new("/usr/sbin/lsof");
    command
        .args(["-nP", "-a", "-iTCP", "-sTCP:LISTEN", "-Fpcfn"])
        .stdin(Stdio::null())
        .kill_on_drop(true);
    let output = tokio::time::timeout(Duration::from_secs(5), command.output())
        .await
        .map_err(|_| BackendError::internal("Reading listening ports timed out."))?
        .map_err(|error| {
            BackendError::internal(format!("Listening ports could not be read: {error}"))
        })?;

    // lsof returns 1 with no output when there are no matching sockets.
    if !output.status.success()
        && !(output.status.code() == Some(1)
            && output.stdout.is_empty()
            && output.stderr.is_empty())
    {
        return Err(BackendError::internal(format!(
            "Listening ports could not be read: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        )));
    }

    let mut ports = parse(&String::from_utf8_lossy(&output.stdout));
    let mut identities = BTreeMap::new();
    for entry in &mut ports {
        let identity = identities
            .entry(entry.pid)
            .or_insert_with(|| identity(entry.pid));
        if let Some((started_at, uid)) = identity {
            entry.started_at = Some(started_at.clone());
            entry.can_stop = stoppable(
                entry.pid,
                *uid,
                unsafe { libc::geteuid() },
                std::process::id(),
            );
        }
        let pgid = unsafe { libc::getpgid(entry.pid) };
        entry.execution_id = groups
            .iter()
            .find(|(_, group)| *group == pgid)
            .map(|(id, _)| *id);
    }
    Ok(ports)
}

fn stoppable(pid: i32, uid: u32, own_uid: u32, own_pid: u32) -> bool {
    pid > 1 && pid as u32 != own_pid && uid == own_uid
}

#[cfg(target_os = "macos")]
fn identity(pid: i32) -> Option<(String, u32)> {
    let mut info = std::mem::MaybeUninit::<libc::proc_bsdinfo>::uninit();
    let size = std::mem::size_of::<libc::proc_bsdinfo>() as i32;
    let read = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTBSDINFO,
            0,
            info.as_mut_ptr().cast(),
            size,
        )
    };
    if read != size {
        return None;
    }
    let info = unsafe { info.assume_init() };
    // Microseconds, rather than only the PID or a seconds-resolution timestamp,
    // prevent a stale row from targeting a different process after PID reuse.
    Some((
        format!("{}:{}", info.pbi_start_tvsec, info.pbi_start_tvusec),
        info.pbi_uid,
    ))
}

#[cfg(not(target_os = "macos"))]
fn identity(_pid: i32) -> Option<(String, u32)> {
    None
}

pub fn validate<'a>(ports: &'a [ListeningPort], target: &PortTarget) -> Result<&'a ListeningPort> {
    ports
        .iter()
        .find(|entry| entry.matches(target))
        .ok_or_else(|| {
            BackendError::new(
                ErrorKind::NotFound,
                "That listening socket changed or disappeared. Refresh the ports and try again.",
            )
        })
}

pub fn terminate(entry: &ListeningPort) -> Result<()> {
    if !entry.can_stop || entry.started_at.is_none() {
        return Err(BackendError::new(
            ErrorKind::InvalidInput,
            "This process cannot be stopped by Pulso.",
        ));
    }
    let current = identity(entry.pid);
    if current.as_ref().map(|(started_at, _)| started_at) != entry.started_at.as_ref() {
        return Err(BackendError::new(
            ErrorKind::NotFound,
            "That process changed or disappeared. Refresh the ports first.",
        ));
    }
    // Never signal an external process group, escalate to SIGKILL, or elevate.
    if unsafe { libc::kill(entry.pid, libc::SIGTERM) } != 0 {
        return Err(BackendError::internal(format!(
            "The process could not be stopped: {}",
            std::io::Error::last_os_error()
        )));
    }
    Ok(())
}

fn parse(text: &str) -> Vec<ListeningPort> {
    let mut pid = None;
    let mut process = String::new();
    let mut found = BTreeMap::new();
    for line in text.lines() {
        let Some((field, value)) = line.as_bytes().split_first() else {
            continue;
        };
        let value = String::from_utf8_lossy(value);
        match *field {
            b'p' => {
                pid = value.parse::<i32>().ok().filter(|pid| *pid > 0);
                process.clear();
            }
            b'c' => process = value.into_owned(),
            b'n' => {
                let Some(pid) = pid else { continue };
                let Some((host, port)) = value.rsplit_once(':') else {
                    continue;
                };
                let Ok(port) = port.parse::<u16>() else {
                    continue;
                };
                if port == 0 || host.is_empty() || host.contains("->") {
                    continue;
                }
                let address = value.into_owned();
                found
                    .entry((port, pid, address.clone()))
                    .or_insert_with(|| ListeningPort {
                        pid,
                        process: process.clone(),
                        port,
                        address,
                        started_at: None,
                        execution_id: None,
                        can_stop: false,
                    });
            }
            _ => {}
        }
    }
    found.into_values().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ipv4_ipv6_wildcards_and_multiple_processes_in_port_order() {
        let rows = parse("p42\ncnode\nf19\nn127.0.0.1:5173\nf20\nn[::1]:5173\np91\ncpostgres\nf8\nn*:5432\np92\ncother\nf9\nn*:5173\n");
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[0].process, "node");
        assert_eq!(rows[0].port, 5173);
        assert_eq!(rows[2].pid, 92);
        assert_eq!(rows[3].process, "postgres");
        assert!(rows.iter().all(|row| !row.can_stop));
    }

    #[test]
    fn deduplicates_sockets_and_ignores_malformed_records() {
        let rows = parse("n*:80\npbad\nn*:90\np42\ncnode\nn*:3000\nn*:3000\nn*:0\nn*:99999\nn*:http\nn127.0.0.1:42->127.0.0.1:80\np-1\nn*:4000\n");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].address, "*:3000");
    }

    #[test]
    fn refuses_stale_process_or_socket_identity() {
        let mut rows = parse("p42\ncnode\nn*:3000\n");
        rows[0].started_at = Some("123:456".into());
        let mut target = PortTarget {
            pid: 42,
            port: 3000,
            address: "*:3000".into(),
            started_at: Some("123:456".into()),
        };
        assert!(validate(&rows, &target).is_ok());
        target.started_at = Some("124:456".into());
        assert_eq!(
            validate(&rows, &target).unwrap_err().kind,
            ErrorKind::NotFound
        );
        target.started_at = rows[0].started_at.clone();
        target.address = "127.0.0.1:3000".into();
        assert!(validate(&rows, &target).is_err());
    }

    #[test]
    fn serializes_verified_ports_and_accepts_only_matching_targets() {
        let mut rows = parse("p42\ncnode\nn*:3000\n");
        rows[0].started_at = Some("123:456".into());
        let json = serde_json::to_value(&rows[0]).unwrap();
        assert_eq!(json["startedAt"], "123:456");
        assert_eq!(json["executionId"], serde_json::Value::Null);
        assert_eq!(json["canStop"], false);
        let target: PortTarget = serde_json::from_value(json).unwrap();
        assert!(validate(&rows, &target).is_ok());
    }

    #[test]
    fn protects_system_other_user_and_self_processes() {
        assert!(stoppable(42, 501, 501, 99));
        assert!(!stoppable(1, 501, 501, 99));
        assert!(!stoppable(0, 501, 501, 99));
        assert!(!stoppable(42, 0, 501, 99));
        assert!(!stoppable(99, 501, 501, 99));
    }

    /// Only becomes a listener in the isolated child launched by the test below.
    #[test]
    fn listener_fixture() {
        if std::env::var("PULSO_PORT_TEST_CHILD").as_deref() != Ok("1") {
            return;
        }
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        println!("PULSO_TEST_PORT={}", listener.local_addr().unwrap().port());
        std::thread::sleep(Duration::from_secs(15));
        drop(listener);
    }

    #[tokio::test]
    #[cfg(target_os = "macos")]
    async fn associates_child_groups_and_stops_only_the_owned_test_fixture() {
        use std::io::BufRead;
        use std::os::unix::process::CommandExt;

        struct Fixture(std::process::Child);
        impl Drop for Fixture {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
        let mut fixture = Fixture(
            std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "process::listeners::tests::listener_fixture",
                    "--nocapture",
                ])
                .env("PULSO_PORT_TEST_CHILD", "1")
                .process_group(0)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .spawn()
                .unwrap(),
        );
        let output = fixture.0.stdout.take().unwrap();
        let port = std::io::BufReader::new(output)
            .lines()
            .filter_map(|line| {
                line.ok()?
                    .strip_prefix("PULSO_TEST_PORT=")?
                    .parse::<u16>()
                    .ok()
            })
            .next()
            .unwrap();
        let pid = fixture.0.id() as i32;
        let external = scan(&[])
            .await
            .unwrap()
            .into_iter()
            .find(|row| row.pid == pid && row.port == port)
            .unwrap();
        assert!(external.can_stop);
        assert_eq!(external.execution_id, None);
        let managed = scan(&[(7, pid)])
            .await
            .unwrap()
            .into_iter()
            .find(|row| row.pid == pid && row.port == port)
            .unwrap();
        assert_eq!(managed.execution_id, Some(7));
        let mut stale = external.clone();
        stale.started_at = Some("stale identity".into());
        assert_eq!(terminate(&stale).unwrap_err().kind, ErrorKind::NotFound);
        assert!(fixture.0.try_wait().unwrap().is_none());
        terminate(&external).unwrap();
        tokio::time::timeout(Duration::from_secs(3), async {
            while fixture.0.try_wait().unwrap().is_none() {
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .unwrap();
        assert!(!scan(&[])
            .await
            .unwrap()
            .iter()
            .any(|row| row.pid == pid && row.port == port));
    }

    #[tokio::test]
    #[cfg(target_os = "macos")]
    async fn discovers_a_real_external_listener_without_touching_it() {
        let socket = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = socket.local_addr().unwrap().port();
        let rows = scan(&[]).await.unwrap();
        let row = rows
            .iter()
            .find(|row| row.port == port && row.pid as u32 == std::process::id())
            .unwrap();
        assert!(row.started_at.is_some());
        assert_eq!(row.execution_id, None);
        assert!(!row.can_stop);
    }
}
