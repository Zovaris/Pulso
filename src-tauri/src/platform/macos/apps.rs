use std::path::{Path, PathBuf};

use objc2::rc::autoreleasepool;
use objc2_app_kit::{
    NSBitmapImageFileType, NSBitmapImageRep, NSBitmapImageRepPropertyKey, NSWorkspace,
};
use objc2_foundation::{NSDictionary, NSSize, NSString};

use objc2::runtime::AnyObject;

use crate::support::error::{BackendError, Result};

/// One application Pulso can hand a project folder to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KnownApp {
    pub id: &'static str,
    pub name: &'static str,
    pub bundle_id: &'static str,
}

pub const FINDER: KnownApp = KnownApp {
    id: "finder",
    name: "Finder",
    bundle_id: "com.apple.finder",
};

/// Editors, most likely first. The order only decides what we suggest; nothing
/// here is shown unless LaunchServices confirms it is installed.
pub const EDITORS: &[KnownApp] = &[
    KnownApp {
        id: "cursor",
        name: "Cursor",
        bundle_id: "com.todesktop.230313mzl4w4u92",
    },
    KnownApp {
        id: "vscode",
        name: "Visual Studio Code",
        bundle_id: "com.microsoft.VSCode",
    },
    KnownApp {
        id: "zed",
        name: "Zed",
        bundle_id: "dev.zed.Zed",
    },
    KnownApp {
        id: "windsurf",
        name: "Windsurf",
        bundle_id: "com.exafunction.windsurf",
    },
    KnownApp {
        id: "xcode",
        name: "Xcode",
        bundle_id: "com.apple.dt.Xcode",
    },
    KnownApp {
        id: "sublime",
        name: "Sublime Text",
        bundle_id: "com.sublimetext.4",
    },
    KnownApp {
        id: "nova",
        name: "Nova",
        bundle_id: "com.panic.Nova",
    },
    KnownApp {
        id: "textmate",
        name: "TextMate",
        bundle_id: "com.macromates.TextMate",
    },
    KnownApp {
        id: "intellij",
        name: "IntelliJ IDEA",
        bundle_id: "com.jetbrains.intellij",
    },
    KnownApp {
        id: "webstorm",
        name: "WebStorm",
        bundle_id: "com.jetbrains.WebStorm",
    },
    KnownApp {
        id: "goland",
        name: "GoLand",
        bundle_id: "com.jetbrains.goland",
    },
    KnownApp {
        id: "pycharm",
        name: "PyCharm",
        bundle_id: "com.jetbrains.pycharm",
    },
    KnownApp {
        id: "android-studio",
        name: "Android Studio",
        bundle_id: "com.google.android.studio",
    },
    KnownApp {
        id: "vscode-insiders",
        name: "VS Code Insiders",
        bundle_id: "com.microsoft.VSCodeInsiders",
    },
    KnownApp {
        id: "zed-preview",
        name: "Zed Preview",
        bundle_id: "dev.zed.Zed-Preview",
    },
    KnownApp {
        id: "bbedit",
        name: "BBEdit",
        bundle_id: "com.barebones.bbedit",
    },
    KnownApp {
        id: "emacs",
        name: "Emacs",
        bundle_id: "org.gnu.Emacs",
    },
];

pub fn editor(id: &str) -> Option<KnownApp> {
    if id == FINDER.id {
        return Some(FINDER);
    }

    EDITORS.iter().copied().find(|app| app.id == id)
}

pub fn is_installed(id: &str, installed: &[String]) -> bool {
    installed.iter().any(|candidate| candidate == id)
}

/// Which app should take the folder: what was asked for if it is really there,
/// otherwise the most preferred one that is. `None` means nothing is installed
/// and the folder should be revealed instead.
pub fn choose(requested: Option<&str>, installed: &[String]) -> Option<KnownApp> {
    requested
        .and_then(editor)
        .filter(|app| is_installed(app.id, installed))
        .or_else(|| {
            EDITORS
                .iter()
                .find(|app| is_installed(app.id, installed))
                .copied()
        })
}

const OPENER: &str = "/usr/bin/open";

/// Hands a folder to an app, or to Finder when there is no app to hand it to.
pub fn open_with(bundle_id: Option<&str>, path: &str) -> Result<()> {
    let status = std::process::Command::new(OPENER)
        .args(open_args(bundle_id, path))
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|error| {
            BackendError::internal(format!("The folder could not be handed over: {error}"))
        })?;

    if !status.success() {
        return Err(BackendError::internal("macOS refused to open that folder."));
    }

    Ok(())
}

/// What `open` needs to launch an app by identifier, or to reveal a folder when
/// there is no editor to launch.
pub fn open_args(bundle_id: Option<&str>, path: &str) -> Vec<String> {
    match bundle_id {
        Some(bundle_id) => vec!["-b".to_string(), bundle_id.to_string(), path.to_string()],
        None => vec!["-R".to_string(), path.to_string()],
    }
}

/// Resolves a bundle identifier through LaunchServices, so an app is found
/// wherever the user keeps it, not only in `/Applications`.
///
/// Main thread only, and it must stay that way: `NSWorkspace` is not off-main
/// safe for icon rendering.
pub fn bundle_path(bundle_id: &str) -> Option<PathBuf> {
    autoreleasepool(|_pool| {
        let workspace = NSWorkspace::sharedWorkspace();
        let identifier = NSString::from_str(bundle_id);
        let url = workspace.URLForApplicationWithBundleIdentifier(&identifier)?;
        let path = url.path()?;

        Some(PathBuf::from(path.to_string()))
    })
}

/// The icon the user actually has installed, drawn by AppKit. We never ship
/// anyone's artwork, and the icon is current on every macOS version.
pub fn icon_png(path: &Path, size: f64) -> Option<Vec<u8>> {
    autoreleasepool(|_pool| {
        let workspace = NSWorkspace::sharedWorkspace();
        let image = workspace.iconForFile(&NSString::from_str(&path.to_string_lossy()));
        image.setSize(NSSize::new(size, size));

        let tiff = image.TIFFRepresentation()?;
        let representation = NSBitmapImageRep::imageRepWithData(&tiff)?;
        let properties = NSDictionary::<NSBitmapImageRepPropertyKey, AnyObject>::new();
        let png = unsafe {
            representation
                .representationUsingType_properties(NSBitmapImageFileType::PNG, &properties)
        }?;

        Some(png.to_vec())
    })
}

#[cfg(test)]
mod tests;
