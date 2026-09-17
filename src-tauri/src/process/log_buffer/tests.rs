use super::*;

const CAP: usize = 2000;

fn buffer() -> LogBuffer {
    LogBuffer::new(Arc::new(AtomicUsize::new(CAP)))
}

#[test]
fn colour_codes_and_carriage_returns_never_reach_the_ui() {
    let buffer = buffer();
    buffer.push(LogStream::Stdout, "\u{1b}[32mready\u{1b}[0m\r");

    let lines = buffer.tail(10);
    assert_eq!(lines[0].text, "ready");
}

#[test]
fn progress_bars_and_hyperlinks_leave_no_residue() {
    let buffer = buffer();
    buffer.push(
        LogStream::Stdout,
        "\u{1b}[2K\u{1b}[1G 34% \u{1b}]8;;https://example.com\u{7}link\u{1b}]8;;\u{7} done",
    );

    let lines = buffer.tail(10);
    assert_eq!(lines[0].text, " 34% link done");
}

#[test]
fn sequence_numbers_only_move_forward() {
    let buffer = buffer();

    for index in 0..5 {
        buffer.push(LogStream::Stdout, &format!("line {index}"));
    }

    let lines = buffer.tail(10);
    assert_eq!(lines.len(), 5);
    assert_eq!(lines[0].seq, 1);
    assert_eq!(lines[4].seq, 5);
    assert_eq!(buffer.after(3, 10).len(), 2);
}

#[test]
fn blank_lines_are_dropped() {
    let buffer = buffer();
    buffer.push(LogStream::Stderr, "   ");

    assert!(buffer.tail(10).is_empty());
}

#[test]
fn the_buffer_forgets_the_oldest_lines_first() {
    let buffer = buffer();

    for index in 0..(CAP + 50) {
        buffer.push(LogStream::Stdout, &format!("line {index}"));
    }

    let lines = buffer.tail(CAP + 100);
    assert_eq!(lines.len(), CAP);
    assert_eq!(lines[0].text, "line 50");
}

#[test]
fn raising_the_cap_keeps_more_of_what_already_arrived() {
    let limit = Arc::new(AtomicUsize::new(10));
    let buffer = LogBuffer::new(Arc::clone(&limit));

    for index in 0..20 {
        buffer.push(LogStream::Stdout, &format!("line {index}"));
    }
    assert_eq!(buffer.tail(100).len(), 10);

    limit.store(50, Ordering::Relaxed);
    buffer.push(LogStream::Stdout, "line 20");

    assert_eq!(buffer.tail(100).len(), 11);
}

#[test]
fn a_very_long_line_is_cut_by_bytes_not_only_by_count() {
    let buffer = LogBuffer::new(Arc::new(AtomicUsize::new(10)));
    let long = "x".repeat(4096);

    for index in 0..10 {
        buffer.push(LogStream::Stdout, &format!("{index} {long}"));
    }

    let lines = buffer.tail(100);
    assert!(lines.len() < 10);
    assert!(lines.last().unwrap().text.starts_with("9 "));
}

#[test]
fn taking_pending_empties_it() {
    let buffer = buffer();
    buffer.push(LogStream::Stdout, "one");

    assert_eq!(buffer.take_pending().len(), 1);
    assert!(buffer.take_pending().is_empty());
    assert_eq!(buffer.tail(10).len(), 1);
}
