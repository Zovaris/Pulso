use super::*;

fn preferences() -> Preferences {
    Preferences {
        theme: ThemePref::System,
        transparency: true,
        locale: Locale::Es,
        sound: true,
        editor: Some("cursor".to_string()),
        open_at_login: false,
        keep_running: true,
        confirm_stop: false,
        notify_on_failure: true,
        log_lines: DEFAULT_LOG_LINES,
    }
}

#[test]
fn every_theme_survives_a_round_trip() {
    for theme in [ThemePref::Dark, ThemePref::Light, ThemePref::System] {
        assert_eq!(ThemePref::parse(theme.as_str()), Some(theme));
    }
}

#[test]
fn a_theme_nobody_ships_is_refused() {
    assert_eq!(ThemePref::parse("midnight"), None);
    assert_eq!(ThemePref::parse("Dark"), None);
}

#[test]
fn every_locale_survives_a_round_trip() {
    for locale in [Locale::Es, Locale::En] {
        assert_eq!(Locale::parse(locale.as_str()), Some(locale));
    }
}

#[test]
fn a_locale_nobody_ships_is_refused() {
    assert_eq!(Locale::parse("pt"), None);
    assert_eq!(Locale::parse(""), None);
}

#[test]
fn preferences_reach_the_frontend_the_way_it_reads_them() {
    let json = serde_json::to_value(preferences()).expect("preferences should serialize");

    assert_eq!(json["theme"], "system");
    assert_eq!(json["transparency"], true);
    assert_eq!(json["locale"], "es");
    assert_eq!(json["sound"], true);
    assert_eq!(json["editor"], "cursor");
    assert_eq!(json["openAtLogin"], false);
    assert_eq!(json["keepRunning"], true);
    assert_eq!(json["confirmStop"], false);
    assert_eq!(json["notifyOnFailure"], true);
    assert_eq!(json["logLines"], DEFAULT_LOG_LINES);
}

#[test]
fn the_frontend_can_send_preferences_back_unchanged() {
    let original = preferences();
    let json = serde_json::to_string(&original).expect("preferences should serialize");
    let parsed: Preferences = serde_json::from_str(&json).expect("preferences should deserialize");

    assert_eq!(parsed, original);
}

#[test]
fn a_payload_from_the_older_shape_still_parses() {
    let parsed: Preferences = serde_json::from_str(
        r#"{"theme":"dark","transparency":false,"locale":"en","sound":false}"#,
    )
    .expect("the older payload should still parse");

    assert_eq!(parsed.editor, None);
    assert!(!parsed.open_at_login);
    assert!(parsed.keep_running);
    assert!(!parsed.confirm_stop);
    assert!(parsed.notify_on_failure);
    assert_eq!(parsed.log_lines, DEFAULT_LOG_LINES);
}

#[test]
fn a_missing_sound_preference_means_sounds_are_on() {
    assert!(sound_pref(None));
    assert!(sound_pref(Some("1")));
    assert!(!sound_pref(Some("0")));
}

#[test]
fn a_stored_switch_that_makes_no_sense_falls_back() {
    assert!(bool_pref(None, true));
    assert!(!bool_pref(None, false));
    assert!(bool_pref(Some("maybe"), true));
    assert!(!bool_pref(Some("yes"), false));
    assert!(bool_pref(Some("1"), false));
    assert!(!bool_pref(Some("0"), true));
}

#[test]
fn an_absent_log_cap_gets_the_default() {
    assert_eq!(log_lines_pref(None), DEFAULT_LOG_LINES);
    assert_eq!(log_lines_pref(Some("")), DEFAULT_LOG_LINES);
    assert_eq!(log_lines_pref(Some("nope")), DEFAULT_LOG_LINES);
}

#[test]
fn a_log_cap_outside_the_choices_is_refused() {
    assert_eq!(log_lines_pref(Some("9999999")), DEFAULT_LOG_LINES);
    assert_eq!(log_lines_pref(Some("0")), DEFAULT_LOG_LINES);
}

#[test]
fn every_offered_log_cap_survives() {
    for lines in LOG_LINE_CHOICES {
        assert_eq!(log_lines_pref(Some(&lines.to_string())), lines);
    }
}

#[test]
fn the_stored_keys_stay_where_the_preferences_were_written() {
    assert_eq!(THEME_KEY, "ui.theme");
    assert_eq!(TRANSPARENCY_KEY, "ui.transparency");
    assert_eq!(LOCALE_KEY, "ui.locale");
    assert_eq!(SOUND_KEY, "ui.sound");
    assert_eq!(EDITOR_KEY, "ui.editor");
    assert_eq!(LOG_LINES_KEY, "logs.maxLines");
    assert_eq!(KEEP_RUNNING_KEY, "ui.keepRunning");
    assert_eq!(CONFIRM_STOP_KEY, "ui.confirmStop");
    assert_eq!(OPEN_AT_LOGIN_KEY, "ui.openAtLogin");
    assert_eq!(NOTIFY_ON_FAILURE_KEY, "ui.notifyOnFailure");
}
