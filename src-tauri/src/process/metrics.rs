use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

use crate::domain::metrics::MetricSample;
use crate::process::supervisor::ProcessSupervisor;

pub const INTERVAL: Duration = Duration::from_secs(2);

pub type MetricsNotifier = Arc<dyn Fn(&[MetricSample]) + Send + Sync + 'static>;

/// One process as the sampler sees it: its identity, and what it costs.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Probe {
    pub pid: i32,
    pub cpu: f32,
    pub memory: u64,
}

/// Sums what belongs to each process group.
///
/// `group_of` is the only part that talks to the kernel, so the arithmetic is
/// testable: on macOS it is `getpgid`, and a probe whose group cannot be read is
/// left out instead of being counted as its own group.
pub fn aggregate(
    groups: &[(i64, i32)],
    probes: &[Probe],
    group_of: impl Fn(i32) -> Option<i32>,
) -> Vec<MetricSample> {
    let mut totals: HashMap<i32, (f32, u64, usize)> = HashMap::new();

    for probe in probes {
        let Some(group) = group_of(probe.pid) else {
            continue;
        };

        let entry = totals.entry(group).or_insert((0.0, 0, 0));
        entry.0 += probe.cpu;
        entry.1 += probe.memory;
        entry.2 += 1;
    }

    groups
        .iter()
        .map(|(execution_id, pgid)| {
            let (cpu, memory, processes) = totals.get(pgid).copied().unwrap_or((0.0, 0, 0));

            MetricSample {
                execution_id: *execution_id,
                cpu,
                memory,
                processes,
            }
        })
        .collect()
}

fn group_of(pid: i32) -> Option<i32> {
    let group = unsafe { libc::getpgid(pid) };

    (group > 0).then_some(group)
}

fn read(system: &System) -> Vec<Probe> {
    system
        .processes()
        .iter()
        .map(|(pid, process)| Probe {
            pid: pid.as_u32() as i32,
            cpu: process.cpu_usage(),
            memory: process.memory(),
        })
        .collect()
}

/// Walks every live group every `INTERVAL`.
///
/// The thread sleeps the whole interval whether or not anything is running, and
/// nothing is queued for later: a hidden webview simply misses samples, which is
/// the point. An empty reading is only sent once, when the last process leaves,
/// so an idle app is silent between ticks.
pub fn spawn(supervisor: Arc<ProcessSupervisor>, notifier: MetricsNotifier) {
    std::thread::spawn(move || {
        let mut system = System::new();
        let mut sent_empty = false;

        loop {
            let groups = supervisor.live_groups();

            if groups.is_empty() {
                if !sent_empty {
                    notifier(&[]);
                    sent_empty = true;
                }

                std::thread::sleep(INTERVAL);
                continue;
            }

            sent_empty = false;

            system.refresh_processes_specifics(
                ProcessesToUpdate::All,
                true,
                ProcessRefreshKind::nothing().with_cpu().with_memory(),
            );

            notifier(&aggregate(&groups, &read(&system), group_of));
            std::thread::sleep(INTERVAL);
        }
    });
}

#[cfg(test)]
mod tests;
