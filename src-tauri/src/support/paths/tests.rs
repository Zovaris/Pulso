use super::*;

fn scratch(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "soffy-{name}-{}-{}",
        std::process::id(),
        crate::support::now_ms()
    ))
}

#[test]
fn a_folder_that_is_not_there_comes_back_as_missing() {
    let path = scratch("absent");

    let error = canonical_dir(&path).expect_err("a path that does not exist cannot resolve");

    assert_eq!(error.kind, ErrorKind::NotFound);
    assert_eq!(error.path.as_deref(), Some(path.to_string_lossy().as_ref()));
}

#[test]
fn a_file_is_refused_by_name() {
    let path = scratch("file");
    std::fs::write(&path, "not a folder").expect("the scratch file should be written");

    let error = canonical_dir(&path).expect_err("a file is not a folder");

    assert_eq!(error.kind, ErrorKind::NotADirectory);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn a_folder_comes_back_absolute_and_real() {
    let path = scratch("dir");
    std::fs::create_dir_all(&path).expect("the scratch folder should be made");

    let canonical = canonical_dir(&path).expect("a real folder should resolve");

    assert!(canonical.is_absolute());
    assert!(canonical.is_dir());
    assert!(canonical.exists());
    let _ = std::fs::remove_dir_all(&path);
}

#[test]
fn the_name_is_the_last_component() {
    assert_eq!(
        display_name(Path::new("/Users/example/astro-portfolio")),
        "astro-portfolio"
    );
    assert_eq!(display_name(Path::new("/")), "/");
}

#[test]
fn availability_follows_the_disk() {
    assert!(is_available("/"));
    assert!(!is_available("/definitely/not/a/folder"));
}
