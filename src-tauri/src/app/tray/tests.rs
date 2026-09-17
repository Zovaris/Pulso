use super::*;

#[test]
fn the_tooltip_counts_in_english() {
    assert_eq!(label(0, Locale::En), "Pulso — no processes running");
    assert_eq!(label(1, Locale::En), "Pulso — one process running");
    assert_eq!(label(7, Locale::En), "Pulso — 7 processes running");
}

#[test]
fn the_tooltip_counts_in_spanish() {
    assert_eq!(label(0, Locale::Es), "Pulso — sin procesos activos");
    assert_eq!(label(1, Locale::Es), "Pulso — un proceso activo");
    assert_eq!(label(7, Locale::Es), "Pulso — 7 procesos activos");
}
