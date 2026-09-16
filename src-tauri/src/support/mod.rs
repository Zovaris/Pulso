pub mod error;
pub mod paths;

/// Milliseconds since the Unix epoch. Only used for ordering, so a clock that
/// refuses to move forward is not worth failing a command over.
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}
