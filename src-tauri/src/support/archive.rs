use std::io::Write;
use std::path::Path;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use super::error::{BackendError, ErrorKind, Result};

/// Stores files without deflating them: a diagnostic bundle is a few small text
/// files, so the compression is not worth the dependency it would drag in.
pub fn write_zip(path: &Path, files: &[(String, Vec<u8>)]) -> Result<()> {
    let handle = std::fs::File::create(path).map_err(|error| {
        BackendError::at(
            ErrorKind::Unreadable,
            path,
            format!("The bundle could not be created: {error}"),
        )
    })?;

    let mut zip = ZipWriter::new(handle);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Stored)
        .unix_permissions(0o644);

    for (name, body) in files {
        zip.start_file(name, options).map_err(|error| {
            BackendError::internal(format!("{name} could not be added to the bundle: {error}"))
        })?;
        zip.write_all(body).map_err(|error| {
            BackendError::internal(format!("{name} could not be written: {error}"))
        })?;
    }

    zip.finish().map_err(|error| {
        BackendError::internal(format!("The bundle could not be finished: {error}"))
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn path(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "pulso-{name}-{}-{:?}.zip",
            crate::support::now_ms(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_file(&path);

        path
    }

    #[test]
    fn what_goes_in_can_be_read_back_out() {
        let file = path("archive-round-trip");
        write_zip(
            &file,
            &[
                ("projects.json".to_string(), b"[]".to_vec()),
                ("versions.txt".to_string(), b"Pulso 0.1.0\n".to_vec()),
            ],
        )
        .expect("the bundle is written");

        let mut archive = zip::ZipArchive::new(std::fs::File::open(&file).unwrap()).unwrap();
        assert_eq!(archive.len(), 2);

        let mut body = String::new();
        archive
            .by_name("versions.txt")
            .unwrap()
            .read_to_string(&mut body)
            .unwrap();

        assert_eq!(body, "Pulso 0.1.0\n");

        let _ = std::fs::remove_file(&file);
    }

    #[test]
    fn the_names_keep_their_folder_shape() {
        let file = path("archive-nested");
        write_zip(&file, &[("logs/dev.log".to_string(), b"ready\n".to_vec())])
            .expect("the bundle is written");

        let mut archive = zip::ZipArchive::new(std::fs::File::open(&file).unwrap()).unwrap();
        assert!(archive.by_name("logs/dev.log").is_ok());

        let _ = std::fs::remove_file(&file);
    }

    #[test]
    fn an_empty_bundle_is_still_a_zip() {
        let file = path("archive-empty");
        write_zip(&file, &[]).expect("the bundle is written");

        let archive = zip::ZipArchive::new(std::fs::File::open(&file).unwrap()).unwrap();
        assert_eq!(archive.len(), 0);

        let _ = std::fs::remove_file(&file);
    }

    #[test]
    fn a_folder_that_is_not_there_is_reported() {
        let error = write_zip(
            Path::new("/tmp/pulso-nowhere/nested/bundle.zip"),
            &[("a.txt".to_string(), b"a".to_vec())],
        )
        .unwrap_err();

        assert_eq!(error.kind, ErrorKind::Unreadable);
    }
}
