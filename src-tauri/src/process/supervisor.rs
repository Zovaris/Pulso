use std::collections::HashMap;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command as StdCommand, Stdio};
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tokio::task::JoinHandle;
use tokio::time::{sleep, Instant};

use crate::domain::command::DetectedCommand;
use crate::domain::execution::{Execution, ExecutionState};
use crate::domain::log::{LogLine, LogSnapshot, LogStream};
use crate::platform::macos::environment::ShellEnvironment;
use crate::process::log_buffer::{self, LogBuffer};
use crate::process::{ports, signals};
use crate::support::error::{BackendError, ErrorKind, Result};
use crate::support::now_ms;

const GRACE: Duration = Duration::from_secs(6);
const QUIT_GRACE: Duration = Duration::from_secs(3);
const CONFIRM_TIMEOUT: Duration = Duration::from_secs(2);
const POLL: Duration = Duration::from_millis(20);
const FLUSH: Duration = Duration::from_millis(50);
const KEPT_FINISHED: usize = 50;
const MAX_LINE_BYTES: usize = 16_384;
const TRUNCATED: &[u8] = b" [truncated]";

pub type ExecutionNotifier = Arc<dyn Fn(&Execution) + Send + Sync + 'static>;
pub type LogNotifier = Arc<dyn Fn(i64, &[LogLine]) + Send + Sync + 'static>;
pub type FinishedNotifier = Arc<dyn Fn(&Execution, &[LogLine]) + Send + Sync + 'static>;
pub type RemovedNotifier = Arc<dyn Fn(&[i64]) + Send + Sync + 'static>;

pub struct ProcessSupervisor {
    notifier: ExecutionNotifier,
    log_notifier: LogNotifier,
    finished: Mutex<Option<FinishedNotifier>>,
    removed: Mutex<Option<RemovedNotifier>>,
    environment: Arc<ShellEnvironment>,
    executions: Arc<Mutex<HashMap<i64, Managed>>>,
    next_id: AtomicI64,
    /// Shared with every `LogBuffer`, so `logs.maxLines` reaches buffers that
    /// are already running instead of only the next ones.
    log_lines: Arc<AtomicUsize>,
}

struct Managed {
    execution: Execution,
    pgid: i32,
    logs: Arc<LogBuffer>,
}

struct StartReservation {
    id: i64,
    executions: Arc<Mutex<HashMap<i64, Managed>>>,
    removed: Option<RemovedNotifier>,
}

impl Drop for StartReservation {
    fn drop(&mut self) {
        let cancelled = if let Ok(mut held) = self.executions.lock() {
            if held
                .get(&self.id)
                .is_some_and(|managed| managed.execution.state == ExecutionState::Starting)
            {
                held.remove(&self.id);
                true
            } else {
                false
            }
        } else {
            false
        };
        if cancelled {
            if let Some(removed) = &self.removed {
                removed(&[self.id]);
            }
        }
    }
}

impl ProcessSupervisor {
    pub fn new(notifier: ExecutionNotifier, log_notifier: LogNotifier) -> Self {
        Self {
            notifier,
            log_notifier,
            finished: Mutex::new(None),
            removed: Mutex::new(None),
            environment: Arc::new(ShellEnvironment::new()),
            executions: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicI64::new(1),
            log_lines: Arc::new(AtomicUsize::new(log_buffer::DEFAULT_LINES)),
        }
    }

    pub fn on_finished(&self, handler: FinishedNotifier) {
        if let Ok(mut finished) = self.finished.lock() {
            *finished = Some(handler);
        }
    }

    pub fn on_removed(&self, handler: RemovedNotifier) {
        if let Ok(mut removed) = self.removed.lock() {
            *removed = Some(handler);
        }
    }

    pub fn set_log_lines(&self, lines: usize) {
        self.log_lines.store(lines.max(1), Ordering::Relaxed);
    }

    pub fn log_lines(&self) -> usize {
        self.log_lines.load(Ordering::Relaxed)
    }

    /// The environment a command in that folder would run with, which is the
    /// thing to look at when a program cannot be found.
    pub fn environment(&self, dir: &Path) -> HashMap<String, String> {
        self.environment.for_dir(dir)
    }

    /// Drops every execution that already finished. Live ones stay, because
    /// clearing the list must never be a way to lose a running process.
    pub fn clear_finished(&self) -> usize {
        let Ok(mut executions) = self.executions.lock() else {
            return 0;
        };

        let finished: Vec<i64> = executions
            .values()
            .filter(|managed| !managed.execution.is_active())
            .map(|managed| managed.execution.id)
            .collect();

        for id in &finished {
            executions.remove(id);
        }

        drop(executions);
        self.notify_removed(&finished);
        finished.len()
    }

    /// The process group of every live execution, which is what the resource
    /// sampler walks.
    pub fn live_groups(&self) -> Vec<(i64, i32)> {
        let Ok(executions) = self.executions.lock() else {
            return Vec::new();
        };

        executions
            .values()
            .filter(|managed| managed.execution.is_active() && managed.pgid > 0)
            .map(|managed| (managed.execution.id, managed.pgid))
            .collect()
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
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let mut execution = Execution::new(id, project_id, command, now_ms());
        execution.restarted_from = restarted_from;
        let logs = Arc::new(LogBuffer::new(Arc::clone(&self.log_lines)));
        self.reserve(Managed {
            execution: execution.clone(),
            pgid: 0,
            logs: Arc::clone(&logs),
        })?;
        let _reservation = StartReservation {
            id,
            executions: Arc::clone(&self.executions),
            removed: self.removed.lock().ok().and_then(|handler| handler.clone()),
        };
        let resolver = Arc::clone(&self.environment);
        let cwd = command.cwd.clone();
        let environment =
            match tokio::task::spawn_blocking(move || resolver.for_dir(Path::new(&cwd))).await {
                Ok(environment) => environment,
                Err(error) => {
                    execution.state = ExecutionState::Failed;
                    execution.revision += 1;
                    execution.ended_at = Some(now_ms());
                    execution.detail =
                        Some(format!("The environment could not be resolved: {error}"));
                    self.remember(Managed {
                        execution: execution.clone(),
                        pgid: 0,
                        logs,
                    });
                    self.finish_history(&execution, &[]);
                    self.notify(&execution);
                    return Ok(execution);
                }
            };

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
                execution.revision += 1;
                self.remember(Managed {
                    pgid: pid.map(|pid| pid as i32).unwrap_or_default(),
                    logs: Arc::clone(&logs),
                    execution: execution.clone(),
                });
                self.notify(&execution);
                let readers = Arc::new(AtomicUsize::new(0));
                let mut tasks = Vec::new();

                if let Some(stdout) = child.stdout.take() {
                    readers.fetch_add(1, Ordering::SeqCst);
                    tasks.push(read_stream(
                        stdout,
                        LogStream::Stdout,
                        Arc::clone(&logs),
                        Arc::clone(&self.executions),
                        Arc::clone(&self.notifier),
                        Arc::clone(&readers),
                        id,
                    ));
                }
                if let Some(stderr) = child.stderr.take() {
                    readers.fetch_add(1, Ordering::SeqCst);
                    tasks.push(read_stream(
                        stderr,
                        LogStream::Stderr,
                        Arc::clone(&logs),
                        Arc::clone(&self.executions),
                        Arc::clone(&self.notifier),
                        Arc::clone(&readers),
                        id,
                    ));
                }

                self.watch(child, id, Arc::clone(&logs), tasks, Arc::clone(&readers));
                self.flush_logs(id, logs, readers);

                Ok(execution)
            }
            Err(error) => {
                execution.state = ExecutionState::Failed;
                execution.revision += 1;
                execution.ended_at = Some(now_ms());
                execution.detail = Some(spawn_failure(&command.program, &error, &environment));

                self.remember(Managed {
                    pgid: 0,
                    logs,
                    execution: execution.clone(),
                });
                self.finish_history(&execution, &[]);
                self.notify(&execution);

                Ok(execution)
            }
        }
    }

    pub async fn stop(&self, execution_id: i64) -> Result<Execution> {
        let mut snapshot = self.snapshot(execution_id)?;
        while snapshot.state == ExecutionState::Starting {
            sleep(POLL).await;
            snapshot = self.snapshot(execution_id)?;
        }
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

        self.await_final_state(execution_id).await.ok_or_else(|| {
            BackendError::internal("The process group did not finish stopping; try again.")
        })
    }

    pub async fn stop_all(&self) {
        while self
            .list()
            .iter()
            .any(|execution| execution.state == ExecutionState::Starting)
        {
            sleep(POLL).await;
        }
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

    fn watch(
        &self,
        mut child: tokio::process::Child,
        execution_id: i64,
        logs: Arc<LogBuffer>,
        mut tasks: Vec<JoinHandle<()>>,
        readers: Arc<AtomicUsize>,
    ) {
        let executions = Arc::clone(&self.executions);
        let notifier = Arc::clone(&self.notifier);
        let finished = self.finished_handler();
        let removed = self.removed.lock().ok().and_then(|handler| handler.clone());
        let log_notifier = Arc::clone(&self.log_notifier);
        let pgid = child.id().map(|pid| pid as i32).unwrap_or_default();

        tokio::spawn(async move {
            let exit_code = child.wait().await.ok().and_then(|status| status.code());
            while signals::group_exists(pgid) {
                sleep(Duration::from_millis(100)).await;
            }
            let deadline = Instant::now() + CONFIRM_TIMEOUT;
            for task in &mut tasks {
                if tokio::time::timeout_at(deadline, &mut *task).await.is_err() {
                    task.abort();
                    let _ = task.await;
                }
            }
            readers.store(0, Ordering::SeqCst);
            let pending = logs.take_pending();
            if !pending.is_empty() {
                log_notifier(execution_id, &pending);
            }
            if let Some(mut snapshot) = finish(&executions, execution_id, exit_code) {
                if let Some(finished) = finished {
                    let tail = logs.tail(crate::persistence::repositories::executions::KEPT_LINES);
                    let saved = snapshot.clone();
                    let _ = tokio::task::spawn_blocking(move || finished(&saved, &tail)).await;
                }
                if let Ok(mut held) = executions.lock() {
                    if let Some(managed) = held.get_mut(&execution_id) {
                        snapshot.revision = snapshot.revision.max(managed.execution.revision + 1);
                        managed.execution = snapshot.clone();
                    }
                }
                notifier(&snapshot);
                let dropped = executions
                    .lock()
                    .map(|mut held| prune(&mut held))
                    .unwrap_or_default();
                if let Some(removed) = removed {
                    if !dropped.is_empty() {
                        removed(&dropped);
                    }
                }
            }
        });
    }

    fn finished_handler(&self) -> Option<FinishedNotifier> {
        self.finished.lock().ok().and_then(|held| held.clone())
    }

    fn finish_history(&self, execution: &Execution, tail: &[LogLine]) {
        if let Some(finished) = self.finished_handler() {
            finished(execution, tail);
        }
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
                "That execution is not in Pulso anymore.",
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
                    "That execution is not in Pulso anymore.",
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

    fn reserve(&self, managed: Managed) -> Result<()> {
        let mut executions = self
            .executions
            .lock()
            .map_err(|_| BackendError::internal("The execution list is not writable."))?;

        let managed_project_id = managed.execution.project_id;
        let managed_command_id = &managed.execution.command_id;
        let active = executions.values().any(|managed| {
            managed.execution.is_active()
                && managed.execution.project_id == managed_project_id
                && managed.execution.command_id == *managed_command_id
        });

        if active {
            return Err(BackendError::new(
                ErrorKind::InvalidInput,
                "That command is already running.",
            ));
        }

        executions.insert(managed.execution.id, managed);
        Ok(())
    }

    fn notify_removed(&self, ids: &[i64]) {
        if ids.is_empty() {
            return;
        }
        let handler = self.removed.lock().ok().and_then(|handler| handler.clone());
        if let Some(handler) = handler {
            handler(ids);
        }
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
                    "That execution is not in Pulso anymore.",
                )
            })?;

            if !managed.execution.is_active() || managed.execution.state == ExecutionState::Stopping
            {
                return Ok(());
            }
            managed.execution.state = ExecutionState::Stopping;
            managed.execution.revision += 1;
            managed.execution.clone()
        };

        self.notify(&snapshot);

        Ok(())
    }

    fn remember(&self, managed: Managed) {
        if let Ok(mut executions) = self.executions.lock() {
            executions.insert(managed.execution.id, managed);
            let dropped = prune(&mut executions);
            drop(executions);
            self.notify_removed(&dropped);
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
    mut reader: R,
    stream: LogStream,
    logs: Arc<LogBuffer>,
    executions: Arc<Mutex<HashMap<i64, Managed>>>,
    notifier: ExecutionNotifier,
    readers: Arc<AtomicUsize>,
    execution_id: i64,
) -> JoinHandle<()>
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut chunk = [0u8; 8192];
        let mut line = Vec::with_capacity(MAX_LINE_BYTES);
        let mut truncated = false;
        let publish = |bytes: &[u8]| {
            let text = String::from_utf8_lossy(bytes);
            logs.push(stream, &text);
            if infer_ports(&executions, execution_id, &text) {
                if let Some(snapshot) = snapshot_of(&executions, execution_id) {
                    notifier(&snapshot);
                }
            }
        };
        loop {
            let size = match reader.read(&mut chunk).await {
                Ok(0) | Err(_) => break,
                Ok(size) => size,
            };
            for byte in &chunk[..size] {
                if *byte == b'\n' {
                    if truncated {
                        line.extend_from_slice(TRUNCATED);
                    }
                    publish(&line);
                    line.clear();
                    truncated = false;
                } else if line.len() < MAX_LINE_BYTES - TRUNCATED.len() {
                    line.push(*byte);
                } else {
                    truncated = true;
                }
            }
        }
        if !line.is_empty() {
            if truncated {
                line.extend_from_slice(TRUNCATED);
            }
            publish(&line);
        }
        readers.fetch_sub(1, Ordering::SeqCst);
    })
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

    let changed = ports::infer(&mut managed.execution.ports, text);
    if changed {
        managed.execution.revision += 1;
    }
    changed
}

fn finish(
    executions: &Mutex<HashMap<i64, Managed>>,
    execution_id: i64,
    exit_code: Option<i32>,
) -> Option<Execution> {
    let guard = executions.lock().ok()?;

    let snapshot = {
        let managed = guard.get(&execution_id)?;
        if !managed.execution.is_active() {
            return None;
        }

        let requested = managed.execution.state == ExecutionState::Stopping;
        let mut execution = managed.execution.clone();
        execution.revision += 1;
        execution.ended_at = Some(now_ms());
        execution.exit_code = exit_code;
        execution.state = if requested || exit_code == Some(0) {
            ExecutionState::Exited
        } else {
            ExecutionState::Failed
        };

        if execution.state == ExecutionState::Failed {
            execution.detail = Some(match exit_code {
                Some(code) => format!("{} exited with code {code}.", execution.program),
                None => format!("{} was terminated by a signal.", execution.program),
            });
        }

        execution
    };

    Some(snapshot)
}

fn prune(executions: &mut HashMap<i64, Managed>) -> Vec<i64> {
    let mut finished: Vec<i64> = executions
        .values()
        .filter(|managed| !managed.execution.is_active())
        .map(|managed| managed.execution.id)
        .collect();

    if finished.len() <= KEPT_FINISHED {
        return Vec::new();
    }

    finished.sort_unstable();
    finished.truncate(finished.len() - KEPT_FINISHED);
    for id in &finished {
        executions.remove(id);
    }
    finished
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
mod tests;
