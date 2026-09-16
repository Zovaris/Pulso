use std::collections::HashMap;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Command;
use tokio::time::{sleep, Instant};

use crate::domain::command::DetectedCommand;
use crate::domain::execution::{Execution, ExecutionState};
use crate::domain::log::{LogLine, LogSnapshot, LogStream};
use crate::platform::macos::environment::ShellEnvironment;
use crate::process::log_buffer::LogBuffer;
use crate::process::{ports, signals};
use crate::support::error::{BackendError, ErrorKind, Result};
use crate::support::now_ms;

const GRACE: Duration = Duration::from_secs(6);
const QUIT_GRACE: Duration = Duration::from_secs(3);
const CONFIRM_TIMEOUT: Duration = Duration::from_secs(2);
const POLL: Duration = Duration::from_millis(20);
const FLUSH: Duration = Duration::from_millis(50);
const KEPT_FINISHED: usize = 50;

pub type ExecutionNotifier = Arc<dyn Fn(&Execution) + Send + Sync + 'static>;
pub type LogNotifier = Arc<dyn Fn(i64, &[LogLine]) + Send + Sync + 'static>;

pub struct ProcessSupervisor {
    notifier: ExecutionNotifier,
    log_notifier: LogNotifier,
    environment: ShellEnvironment,
    executions: Arc<Mutex<HashMap<i64, Managed>>>,
    next_id: AtomicI64,
}

struct Managed {
    execution: Execution,
    pgid: i32,
    logs: Arc<LogBuffer>,
}

impl ProcessSupervisor {
    pub fn new(notifier: ExecutionNotifier, log_notifier: LogNotifier) -> Self {
        Self {
            notifier,
            log_notifier,
            environment: ShellEnvironment::new(),
            executions: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicI64::new(1),
        }
    }

    pub fn list(&self) -> Vec<Execution> {
        let Ok(executions) = self.executions.lock() else {
            return Vec::new();
        };

        let mut snapshots: Vec<Execution> = executions
            .values()
            .map(|managed| managed.execution.clone())
            .collect();
        snapshots.sort_by_key(|execution| execution.id);
        snapshots
    }

    pub async fn start(
        &self,
        project_id: i64,
        command: &DetectedCommand,
        restarted_from: Option<i64>,
    ) -> Result<Execution> {
        self.reject_if_active(project_id, &command.id)?;

        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let environment = self.environment.for_dir(Path::new(&command.cwd));
        let mut execution = Execution::new(id, project_id, command, now_ms());
        execution.restarted_from = restarted_from;

        let mut std_command = StdCommand::new(&command.program);
        std_command
            .args(&command.args)
            .current_dir(&command.cwd)
            .env_clear()
            .envs(&environment)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .process_group(0);

        match Command::from(std_command).spawn() {
            Ok(mut child) => {
                let pid = child.id();
                execution.pid = pid;
                execution.state = ExecutionState::Running;

                let logs = Arc::new(LogBuffer::new());
                let readers = Arc::new(AtomicUsize::new(0));

                if let Some(stdout) = child.stdout.take() {
                    readers.fetch_add(1, Ordering::SeqCst);
                    read_stream(
                        stdout,
                        LogStream::Stdout,
                        Arc::clone(&logs),
                        Arc::clone(&self.executions),
                        Arc::clone(&self.notifier),
                        Arc::clone(&readers),
                        id,
                    );
                }
                if let Some(stderr) = child.stderr.take() {
                    readers.fetch_add(1, Ordering::SeqCst);
                    read_stream(
                        stderr,
                        LogStream::Stderr,
                        Arc::clone(&logs),
                        Arc::clone(&self.executions),
                        Arc::clone(&self.notifier),
                        Arc::clone(&readers),
                        id,
                    );
                }

                self.remember(Managed {
                    pgid: pid.map(|pid| pid as i32).unwrap_or_default(),
                    logs: Arc::clone(&logs),
                    execution: execution.clone(),
                });
                self.notify(&execution);
                self.watch(child, id);
                self.flush_logs(id, logs, readers);

                Ok(execution)
            }
            Err(error) => {
                execution.state = ExecutionState::Failed;
                execution.ended_at = Some(now_ms());
                execution.detail = Some(spawn_failure(&command.program, &error, &environment));

                self.remember(Managed {
                    pgid: 0,
                    logs: Arc::new(LogBuffer::new()),
                    execution: execution.clone(),
                });
                self.notify(&execution);

                Ok(execution)
            }
        }
    }

    pub async fn stop(&self, execution_id: i64) -> Result<Execution> {
        let snapshot = self.snapshot(execution_id)?;
        if !snapshot.is_active() {
            return Ok(snapshot);
        }

        let pgid = self.pgid_of(execution_id)?;
        self.mark_stopping(execution_id)?;

        signals::signal_group(pgid, signals::TERMINATE).map_err(|error| {
            BackendError::internal(format!("The stop signal could not be sent: {error}"))
        })?;

        if !self.await_group_exit(pgid, GRACE).await {
            signals::signal_group(pgid, signals::KILL).map_err(|error| {
                BackendError::internal(format!("The kill signal could not be sent: {error}"))
            })?;
            self.await_group_exit(pgid, CONFIRM_TIMEOUT).await;
        }

        Ok(self
            .await_final_state(execution_id)
            .await
            .unwrap_or(snapshot))
    }

    pub async fn stop_all(&self) {
        let active: Vec<(i64, i32)> = match self.executions.lock() {
            Ok(executions) => executions
                .values()
                .filter(|managed| managed.execution.is_active())
                .map(|managed| (managed.execution.id, managed.pgid))
                .collect(),
            Err(_) => return,
        };

        if active.is_empty() {
            return;
        }

        for (execution_id, _) in &active {
            let _ = self.mark_stopping(*execution_id);
        }

        let groups: Vec<i32> = active
            .iter()
            .map(|(_, pgid)| *pgid)
            .filter(|pgid| signals::group_exists(*pgid))
            .collect();

        for pgid in &groups {
            let _ = signals::signal_group(*pgid, signals::TERMINATE);
        }

        let deadline = Instant::now() + QUIT_GRACE;
        while Instant::now() < deadline {
            if !groups.iter().any(|pgid| signals::group_exists(*pgid)) {
                break;
            }
            sleep(POLL).await;
        }

        for pgid in groups.iter().filter(|pgid| signals::group_exists(**pgid)) {
            let _ = signals::signal_group(*pgid, signals::KILL);
        }

        for (execution_id, _) in &active {
            self.await_final_state(*execution_id).await;
        }
    }

    pub fn logs(
        &self,
        execution_id: i64,
        after_seq: Option<u64>,
        limit: usize,
    ) -> Result<LogSnapshot> {
        let logs = self.logs_of(execution_id)?;

        let lines = match after_seq {
            Some(seq) => logs.after(seq, limit),
            None => logs.tail(limit),
        };

        Ok(LogSnapshot {
            execution_id,
            lines,
        })
    }

    pub fn url(&self, execution_id: i64, port_id: &str) -> Result<String> {
        let execution = self.snapshot(execution_id)?;

        execution
            .ports
            .into_iter()
            .find(|port| port.id == port_id)
            .and_then(|port| port.url)
            .ok_or_else(|| {
                BackendError::new(ErrorKind::NotFound, "That port has no URL to open yet.")
            })
    }

    fn watch(&self, mut child: tokio::process::Child, execution_id: i64) {
        let executions = Arc::clone(&self.executions);
        let notifier = Arc::clone(&self.notifier);

        tokio::spawn(async move {
            let exit_code = child.wait().await.ok().and_then(|status| status.code());
            if let Some(snapshot) = finish(&executions, execution_id, exit_code) {
                notifier(&snapshot);
            }
        });
    }

    fn flush_logs(&self, execution_id: i64, logs: Arc<LogBuffer>, readers: Arc<AtomicUsize>) {
        let executions = Arc::clone(&self.executions);
        let log_notifier = Arc::clone(&self.log_notifier);

        tokio::spawn(async move {
            loop {
                sleep(FLUSH).await;

                let pending = logs.take_pending();
                if !pending.is_empty() {
                    log_notifier(execution_id, &pending);
                    continue;
                }

                if readers.load(Ordering::SeqCst) == 0 && !is_active(&executions, execution_id) {
                    break;
                }
            }
        });
    }

    fn notify(&self, execution: &Execution) {
        (self.notifier)(execution);
    }

    fn snapshot(&self, execution_id: i64) -> Result<Execution> {
        snapshot_of(&self.executions, execution_id).ok_or_else(|| {
            BackendError::new(
                ErrorKind::NotFound,
                "That execution is not in Soffy anymore.",
            )
        })
    }

    fn logs_of(&self, execution_id: i64) -> Result<Arc<LogBuffer>> {
        let executions = self
            .executions
            .lock()
            .map_err(|_| BackendError::internal("The execution list is not readable."))?;

        executions
            .get(&execution_id)
            .map(|managed| Arc::clone(&managed.logs))
            .ok_or_else(|| {
                BackendError::new(
                    ErrorKind::NotFound,
                    "That execution is not in Soffy anymore.",
                )
            })
    }

    fn pgid_of(&self, execution_id: i64) -> Result<i32> {
        let executions = self
            .executions
            .lock()
            .map_err(|_| BackendError::internal("The execution list is not readable."))?;

        executions
            .get(&execution_id)
            .map(|managed| managed.pgid)
            .filter(|pgid| *pgid > 0)
            .ok_or_else(|| {
                BackendError::new(ErrorKind::NotFound, "That execution has no process group.")
            })
    }

    fn reject_if_active(&self, project_id: i64, command_id: &str) -> Result<()> {
        let Ok(executions) = self.executions.lock() else {
            return Ok(());
        };

        let active = executions.values().any(|managed| {
            managed.execution.is_active()
                && managed.execution.project_id == project_id
                && managed.execution.command_id == command_id
        });

        if active {
            return Err(BackendError::new(
                ErrorKind::InvalidInput,
                "That command is already running.",
            ));
        }

        Ok(())
    }

    fn mark_stopping(&self, execution_id: i64) -> Result<()> {
        let snapshot = {
            let mut executions = self
                .executions
                .lock()
                .map_err(|_| BackendError::internal("The execution list is not writable."))?;

            let managed = executions.get_mut(&execution_id).ok_or_else(|| {
                BackendError::new(
                    ErrorKind::NotFound,
                    "That execution is not in Soffy anymore.",
                )
            })?;

            managed.execution.state = ExecutionState::Stopping;
            managed.execution.clone()
        };

        self.notify(&snapshot);

        Ok(())
    }

    fn remember(&self, managed: Managed) {
        if let Ok(mut executions) = self.executions.lock() {
            executions.insert(managed.execution.id, managed);
            prune(&mut executions);
        }
    }

    async fn await_group_exit(&self, pgid: i32, limit: Duration) -> bool {
        let deadline = Instant::now() + limit;

        loop {
            if !signals::group_exists(pgid) {
                return true;
            }
            if Instant::now() >= deadline {
                return false;
            }
            sleep(POLL).await;
        }
    }

    async fn await_final_state(&self, execution_id: i64) -> Option<Execution> {
        let deadline = Instant::now() + CONFIRM_TIMEOUT;

        loop {
            match self.snapshot(execution_id) {
                Ok(snapshot) if !snapshot.is_active() => return Some(snapshot),
                Ok(_) if Instant::now() < deadline => sleep(POLL).await,
                Ok(_) => return None,
                Err(_) => return None,
            }
        }
    }
}

fn read_stream<R>(
    reader: R,
    stream: LogStream,
    logs: Arc<LogBuffer>,
    executions: Arc<Mutex<HashMap<i64, Managed>>>,
    notifier: ExecutionNotifier,
    readers: Arc<AtomicUsize>,
    execution_id: i64,
) where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            logs.push(stream, &line);

            if infer_ports(&executions, execution_id, &line) {
                if let Some(snapshot) = snapshot_of(&executions, execution_id) {
                    notifier(&snapshot);
                }
            }
        }

        readers.fetch_sub(1, Ordering::SeqCst);
    });
}

fn snapshot_of(executions: &Mutex<HashMap<i64, Managed>>, execution_id: i64) -> Option<Execution> {
    executions
        .lock()
        .ok()?
        .get(&execution_id)
        .map(|managed| managed.execution.clone())
}

fn is_active(executions: &Mutex<HashMap<i64, Managed>>, execution_id: i64) -> bool {
    executions
        .lock()
        .ok()
        .and_then(|guarded| {
            guarded
                .get(&execution_id)
                .map(|managed| managed.execution.is_active())
        })
        .unwrap_or(false)
}

fn infer_ports(executions: &Mutex<HashMap<i64, Managed>>, execution_id: i64, text: &str) -> bool {
    let Ok(mut guarded) = executions.lock() else {
        return false;
    };

    let Some(managed) = guarded.get_mut(&execution_id) else {
        return false;
    };

    ports::infer(&mut managed.execution.ports, text)
}

fn finish(
    executions: &Mutex<HashMap<i64, Managed>>,
    execution_id: i64,
    exit_code: Option<i32>,
) -> Option<Execution> {
    let mut guard = executions.lock().ok()?;

    let snapshot = {
        let managed = guard.get_mut(&execution_id)?;
        if !managed.execution.is_active() {
            return None;
        }

        let requested = managed.execution.state == ExecutionState::Stopping;
        managed.execution.ended_at = Some(now_ms());
        managed.execution.exit_code = exit_code;
        managed.execution.state = if requested || exit_code == Some(0) {
            ExecutionState::Exited
        } else {
            ExecutionState::Failed
        };

        if managed.execution.state == ExecutionState::Failed {
            managed.execution.detail = Some(match exit_code {
                Some(code) => format!("{} exited with code {code}.", managed.execution.program),
                None => format!("{} was terminated by a signal.", managed.execution.program),
            });
        }

        managed.execution.clone()
    };

    prune(&mut guard);

    Some(snapshot)
}

fn prune(executions: &mut HashMap<i64, Managed>) {
    let mut finished: Vec<i64> = executions
        .values()
        .filter(|managed| !managed.execution.is_active())
        .map(|managed| managed.execution.id)
        .collect();

    if finished.len() <= KEPT_FINISHED {
        return;
    }

    finished.sort_unstable();
    for id in finished.iter().take(finished.len() - KEPT_FINISHED) {
        executions.remove(id);
    }
}

fn spawn_failure(
    program: &str,
    error: &std::io::Error,
    environment: &HashMap<String, String>,
) -> String {
    match error.kind() {
        std::io::ErrorKind::NotFound => format!(
            "{program} was not found. PATH: {}",
            environment.get("PATH").cloned().unwrap_or_default()
        ),
        _ => format!("{program} could not be started: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::command::CommandCategory;

    fn command(label: &str, program: &str, args: &[&str]) -> DetectedCommand {
        DetectedCommand {
            id: format!("test:{label}"),
            label: label.to_string(),
            program: program.to_string(),
            args: args.iter().map(|arg| arg.to_string()).collect(),
            cwd: std::env::temp_dir().to_string_lossy().into_owned(),
            source: "test".to_string(),
            detector: "test".to_string(),
            category: CommandCategory::Other,
            long_running: false,
        }
    }

    fn supervisor() -> ProcessSupervisor {
        ProcessSupervisor::new(Arc::new(|_| {}), Arc::new(|_, _| {}))
    }

    #[tokio::test]
    async fn a_started_command_runs_and_stops_without_leaving_its_group() {
        let supervisor = supervisor();
        let started = supervisor
            .start(1, &command("sleep", "/bin/sleep", &["30"]), None)
            .await
            .expect("the command should start");

        assert_eq!(started.state, ExecutionState::Running);
        let pgid = started.pid.expect("a running execution has a pid") as i32;
        assert!(signals::group_exists(pgid));

        let stopped = supervisor
            .stop(started.id)
            .await
            .expect("the command stops");
        assert_eq!(stopped.state, ExecutionState::Exited);
        assert!(!signals::group_exists(pgid), "the group outlived the stop");
    }

    #[tokio::test]
    async fn a_process_that_leaves_children_behind_is_stopped_as_a_group() {
        let supervisor = supervisor();
        let started = supervisor
            .start(
                1,
                &command("tree", "/bin/sh", &["-c", "sleep 30 & sleep 30"]),
                None,
            )
            .await
            .expect("the command should start");

        let pgid = started.pid.expect("a running execution has a pid") as i32;
        let stopped = supervisor
            .stop(started.id)
            .await
            .expect("the command stops");

        assert_eq!(stopped.state, ExecutionState::Exited);
        assert!(
            !signals::group_exists(pgid),
            "a child of the command survived the stop"
        );
    }

    #[tokio::test]
    async fn a_command_that_cannot_be_found_fails_with_its_path() {
        let supervisor = supervisor();
        let failed = supervisor
            .start(1, &command("ghost", "/soffy/nowhere/ghost", &[]), None)
            .await
            .expect("a failure is reported, not thrown");

        assert_eq!(failed.state, ExecutionState::Failed);
        assert!(!failed.is_active());

        let detail = failed.detail.unwrap_or_default();
        assert!(detail.contains("/soffy/nowhere/ghost"), "{detail}");
        assert!(detail.contains("PATH"), "{detail}");
    }

    #[tokio::test]
    async fn the_same_command_cannot_run_twice_at_once() {
        let supervisor = supervisor();
        let command = command("sleep", "/bin/sleep", &["30"]);

        let started = supervisor.start(1, &command, None).await.expect("start");
        let rejected = supervisor.start(1, &command, None).await;

        assert!(rejected.is_err());
        supervisor.stop(started.id).await.expect("stop");
    }

    #[tokio::test]
    async fn stopping_everything_leaves_no_group_alive() {
        let supervisor = supervisor();
        let first = supervisor
            .start(1, &command("one", "/bin/sleep", &["30"]), None)
            .await
            .expect("start");
        let second = supervisor
            .start(2, &command("two", "/bin/sleep", &["30"]), None)
            .await
            .expect("start");

        supervisor.stop_all().await;

        let listed = supervisor.list();
        for execution in [first, second] {
            let pgid = execution.pid.expect("a running execution has a pid") as i32;
            assert!(!signals::group_exists(pgid), "the group outlived stop_all");

            let snapshot = listed
                .iter()
                .find(|listed| listed.id == execution.id)
                .expect("still listed");
            assert!(!snapshot.is_active());
        }
    }

    #[tokio::test]
    async fn the_output_of_a_command_reaches_its_buffer() {
        let supervisor = supervisor();
        let started = supervisor
            .start(
                1,
                &command(
                    "talk",
                    "/bin/sh",
                    &[
                        "-c",
                        "echo 'Local http://localhost:4321/en/'; echo down 1>&2",
                    ],
                ),
                None,
            )
            .await
            .expect("start");

        let finished = supervisor
            .await_final_state(started.id)
            .await
            .expect("the command finishes on its own");
        assert_eq!(finished.state, ExecutionState::Exited);

        let mut lines = Vec::new();
        let mut ports = Vec::new();
        for _ in 0..60 {
            lines = supervisor
                .logs(started.id, None, 50)
                .expect("the buffer is readable")
                .lines;
            ports = supervisor
                .snapshot(started.id)
                .expect("the execution is still listed")
                .ports;

            if lines.len() >= 2 && !ports.is_empty() {
                break;
            }
            sleep(FLUSH).await;
        }

        assert_eq!(lines.len(), 2, "both streams are captured");
        assert_eq!(lines[0].stream, LogStream::Stdout);
        assert_eq!(lines[1].stream, LogStream::Stderr);

        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port, 4321);
        assert_eq!(
            supervisor
                .url(started.id, &ports[0].id)
                .expect("the URL is openable"),
            "http://localhost:4321/en/"
        );
    }

    #[test]
    fn finished_executions_are_pruned_but_the_recent_ones_stay() {
        let mut executions: HashMap<i64, Managed> = HashMap::new();

        for id in 1..=(KEPT_FINISHED as i64 + 10) {
            let mut execution = Execution::new(id, 1, &command("sleep", "/bin/sleep", &[]), id);
            execution.state = ExecutionState::Exited;
            executions.insert(
                id,
                Managed {
                    execution,
                    pgid: 0,
                    logs: Arc::new(LogBuffer::new()),
                },
            );
        }

        prune(&mut executions);

        assert_eq!(executions.len(), KEPT_FINISHED);
        assert!(executions.contains_key(&(KEPT_FINISHED as i64 + 10)));
        assert!(!executions.contains_key(&1));
    }
}
