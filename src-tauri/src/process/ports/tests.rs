use super::*;

fn ports_for(text: &str) -> Vec<DetectedPort> {
    let mut ports = Vec::new();
    infer(&mut ports, text);
    ports
}

#[test]
fn a_full_url_gives_a_port_and_something_to_open() {
    let ports = ports_for("┃ Local    http://localhost:4321/en/  ready");

    assert_eq!(ports.len(), 1);
    assert_eq!(ports[0].port, 4321);
    assert_eq!(ports[0].url.as_deref(), Some("http://localhost:4321/en/"));
}

#[test]
fn a_bare_port_is_a_port_without_a_url() {
    let ports = ports_for("Listening on :5173");

    assert_eq!(ports.len(), 1);
    assert_eq!(ports[0].port, 5173);
    assert_eq!(ports[0].url, None);
}

#[test]
fn a_loopback_host_counts_and_a_trailing_slash_does_not_break_it() {
    let ports = ports_for("Server started at http://127.0.0.1:8000/,");

    assert_eq!(ports.len(), 1);
    assert_eq!(ports[0].port, 8000);
    assert_eq!(ports[0].url.as_deref(), Some("http://127.0.0.1:8000/"));
}

#[test]
fn timestamps_and_status_codes_are_not_ports() {
    assert!(ports_for("17:02:49 [302] /en 12ms").is_empty());
    assert!(ports_for("finished in 12:34").is_empty());
    assert!(ports_for("[200] /index 3ms").is_empty());
}

#[test]
fn a_named_port_is_read_without_a_host() {
    assert_eq!(ports_for("ready, listening on port 3000").len(), 1);
    assert_eq!(ports_for("--port=8080").len(), 1);
}

#[test]
fn priviledged_and_standard_ports_are_ignored() {
    assert!(ports_for("http://example.com/").is_empty());
    assert!(ports_for("listening on :80").is_empty());
    assert!(ports_for("localhost:300").is_empty());
}

#[test]
fn the_same_port_is_kept_once_and_gains_its_url_when_it_appears() {
    let mut ports = ports_for("Listening on :4321");
    assert_eq!(ports[0].url, None);

    assert!(infer(&mut ports, "Local http://localhost:4321/"));
    assert_eq!(ports.len(), 1);
    assert_eq!(ports[0].url.as_deref(), Some("http://localhost:4321/"));

    assert!(!infer(&mut ports, "again http://localhost:4321/"));
}
