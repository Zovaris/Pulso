use super::*;

#[test]
fn the_tooltip_counts_in_english() {
    assert_eq!(label(0, Locale::En), "Soffy — no processes running");
    assert_eq!(label(1, Locale::En), "Soffy — one process running");
    assert_eq!(label(7, Locale::En), "Soffy — 7 processes running");
}

#[test]
fn the_tooltip_counts_in_spanish() {
    assert_eq!(label(0, Locale::Es), "Soffy — sin procesos activos");
    assert_eq!(label(1, Locale::Es), "Soffy — un proceso activo");
    assert_eq!(label(7, Locale::Es), "Soffy — 7 procesos activos");
}
