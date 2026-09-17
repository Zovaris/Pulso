use super::*;

fn probe(pid: i32, cpu: f32, memory: u64) -> Probe {
    Probe { pid, cpu, memory }
}

#[test]
fn a_group_taller_than_one_process_is_summed() {
    let groups = [(7, 100)];
    let probes = [
        probe(100, 4.5, 1024),
        probe(101, 2.0, 512),
        probe(102, 1.5, 256),
    ];

    let samples = aggregate(&groups, &probes, |_| Some(100));

    assert_eq!(samples.len(), 1);
    assert_eq!(samples[0].execution_id, 7);
    assert_eq!(samples[0].cpu, 8.0);
    assert_eq!(samples[0].memory, 1792);
    assert_eq!(samples[0].processes, 3);
}

#[test]
fn processes_outside_the_groups_are_not_counted() {
    let groups = [(1, 100)];
    let probes = [probe(100, 1.0, 10), probe(999, 90.0, 1_000_000)];

    let samples = aggregate(&groups, &probes, |pid| {
        if pid == 999 {
            Some(999)
        } else {
            Some(100)
        }
    });

    assert_eq!(samples[0].cpu, 1.0);
    assert_eq!(samples[0].memory, 10);
}

#[test]
fn a_group_with_nothing_left_reads_as_zero() {
    let groups = [(3, 500), (4, 700)];
    let probes = [probe(700, 2.0, 64)];

    let samples = aggregate(&groups, &probes, |_| Some(700));

    assert_eq!(samples[0].execution_id, 3);
    assert_eq!(samples[0].cpu, 0.0);
    assert_eq!(samples[0].memory, 0);
    assert_eq!(samples[0].processes, 0);
    assert_eq!(samples[1].execution_id, 4);
    assert_eq!(samples[1].memory, 64);
}

#[test]
fn a_process_whose_group_cannot_be_read_is_skipped() {
    let groups = [(1, 100)];
    let probes = [probe(100, 1.0, 10), probe(200, 5.0, 5000)];

    let samples = aggregate(&groups, &probes, |pid| (pid == 100).then_some(100));

    assert_eq!(samples[0].cpu, 1.0);
    assert_eq!(samples[0].processes, 1);
}

#[test]
fn every_group_gets_a_sample_even_with_no_probes_at_all() {
    let samples = aggregate(&[(1, 10), (2, 20)], &[], |_| None);

    assert_eq!(samples.len(), 2);
    assert_eq!(samples[1].execution_id, 2);
}

#[test]
fn the_interval_is_the_one_the_design_promises() {
    assert_eq!(INTERVAL, Duration::from_secs(2));
}
