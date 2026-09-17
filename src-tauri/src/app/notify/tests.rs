use super::*;

#[test]
fn the_body_names_the_project_the_command_and_the_code() {
    assert_eq!(
        body(Locale::En, "Apex", "test", Some(1)),
        "Apex · test failed with code 1."
    );
}

#[test]
fn the_spanish_body_is_written_in_spanish() {
    assert_eq!(
        body(Locale::Es, "Apex", "test", Some(1)),
        "Apex · test falló con código 1."
    );
}

#[test]
fn a_signal_death_has_no_code_to_name() {
    assert_eq!(
        body(Locale::En, "Apex", "dev", None),
        "Apex · dev failed with code —."
    );
}

#[test]
fn a_zero_exit_is_still_reported_verbatim() {
    assert!(body(Locale::En, "Apex", "dev", Some(0)).ends_with("code 0."));
}
