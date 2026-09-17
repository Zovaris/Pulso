use super::*;

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
    let json = serde_json::to_value(Preferences {
        theme: ThemePref::System,
        transparency: true,
        locale: Locale::Es,
        sound: true,
    })
    .expect("preferences should serialize");

    assert_eq!(json["theme"], "system");
    assert_eq!(json["transparency"], true);
    assert_eq!(json["locale"], "es");
    assert_eq!(json["sound"], true);
}

#[test]
fn a_missing_sound_preference_means_sounds_are_on() {
    assert!(sound_pref(None));
    assert!(sound_pref(Some("1")));
    assert!(!sound_pref(Some("0")));
}

#[test]
fn the_stored_keys_stay_where_the_preferences_were_written() {
    assert_eq!(THEME_KEY, "ui.theme");
    assert_eq!(TRANSPARENCY_KEY, "ui.transparency");
    assert_eq!(LOCALE_KEY, "ui.locale");
    assert_eq!(SOUND_KEY, "ui.sound");
}
