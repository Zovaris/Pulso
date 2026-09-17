use super::*;

#[test]
fn every_kind_keeps_the_name_the_frontend_switches_on() {
    let cases = [
        (ErrorKind::NotFound, "notFound"),
        (ErrorKind::NotADirectory, "notADirectory"),
        (ErrorKind::Unreadable, "unreadable"),
        (ErrorKind::InvalidInput, "invalidInput"),
        (ErrorKind::Storage, "storage"),
        (ErrorKind::Internal, "internal"),
    ];

    for (kind, name) in cases {
        let json = serde_json::to_value(kind).expect("a kind should serialize");
        assert_eq!(json, serde_json::json!(name));
    }
}

#[test]
fn an_error_carries_its_kind_message_and_path() {
    let error = BackendError::at(
        ErrorKind::Unreadable,
        Path::new("/tmp/project"),
        "The folder could not be read.",
    );
    let json = serde_json::to_value(&error).expect("an error should serialize");

    assert_eq!(json["kind"], "unreadable");
    assert_eq!(json["message"], "The folder could not be read.");
    assert_eq!(json["path"], "/tmp/project");
}

#[test]
fn a_path_is_optional() {
    let error = BackendError::storage("The change could not be saved.");

    assert_eq!(error.path, None);
    assert_eq!(error.to_string(), "The change could not be saved.");
}

#[test]
fn the_path_shows_up_in_the_readable_form() {
    let error = BackendError::at(
        ErrorKind::NotADirectory,
        Path::new("/tmp/notes.txt"),
        "Not a folder.",
    );

    assert_eq!(error.to_string(), "Not a folder. (/tmp/notes.txt)");
}
