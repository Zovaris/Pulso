use super::*;
use std::collections::HashSet;

#[test]
fn every_known_app_has_a_unique_id_and_bundle() {
    let ids: HashSet<&str> = EDITORS.iter().map(|app| app.id).collect();
    let bundles: HashSet<&str> = EDITORS.iter().map(|app| app.bundle_id).collect();

    assert_eq!(ids.len(), EDITORS.len());
    assert_eq!(bundles.len(), EDITORS.len());
}

#[test]
fn finder_is_not_listed_as_an_editor() {
    assert!(EDITORS.iter().all(|app| app.id != FINDER.id));
    assert_eq!(editor(FINDER.id), Some(FINDER));
}

#[test]
fn an_unknown_editor_is_rejected() {
    assert_eq!(editor("vim-in-my-heart"), None);
}

#[test]
fn opening_an_editor_asks_launch_services_for_it() {
    let args = open_args(Some("com.microsoft.VSCode"), "/tmp/one");

    assert_eq!(args, vec!["-b", "com.microsoft.VSCode", "/tmp/one"]);
}

#[test]
fn revealing_a_folder_needs_no_bundle() {
    assert_eq!(open_args(None, "/tmp/one"), vec!["-R", "/tmp/one"]);
}

#[test]
fn a_path_with_spaces_stays_one_argument() {
    let args = open_args(None, "/tmp/two words");

    assert_eq!(args.len(), 2);
    assert_eq!(args[1], "/tmp/two words");
}

#[test]
fn the_system_finder_resolves_on_any_mac() {
    assert!(bundle_path(FINDER.bundle_id).is_some());
}

#[test]
fn a_bundle_that_is_not_installed_resolves_to_nothing() {
    assert_eq!(bundle_path("com.pulso.definitely-not-installed"), None);
}

#[test]
fn an_installed_app_yields_a_png() {
    let Some(path) = bundle_path(FINDER.bundle_id) else {
        return;
    };

    let png = icon_png(&path, 32.0).expect("the Finder icon is drawn");

    assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
}
