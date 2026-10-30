// Tells browsers how to start the bridge: a small "host manifest" in each installed browser's
// NativeMessagingHosts folder, naming Seiza's executable and the extension allowed to use it.
// They're written on every launch, so they always point at the app wherever it's installed.

use std::path::{Path, PathBuf};

use serde_json::{Value, json};

/// The name the extension connects to. Only letters, digits, dots and underscores are allowed.
pub const HOST_NAME: &str = "io.github.lock_in_focus_app.lock_in";

/// The Chrome-family extension: the id unpacked builds get from the public `key` in the
/// extension's manifest, and the id the Chrome Web Store gave it (its build has no key).
const CHROME_EXTENSION_IDS: &[&str] = &["nfaamgjiehkppopelaampopbofjoepca", "nencjadggelocffidegejpekamaeopjc"];

/// The Firefox-family extension, from `browser_specific_settings` in its manifest.
pub const FIREFOX_EXTENSION_ID: &str = "lock-in@lock-in-focus-app.github.io";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Family {
    Chrome,
    Firefox,
}

/// A browser's own data folder, and where it looks for host manifests inside it.
struct Browser {
    dir: PathBuf,
    hosts: &'static str,
    family: Family,
}

/// The browsers Seiza knows how to link to on this computer.
fn browsers() -> Vec<Browser> {
    let mut list = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(support) = dirs::data_dir() {
        let chrome = [
            "Google/Chrome",
            "Google/Chrome Beta",
            "Google/Chrome for Testing",
            "Chromium",
            "BraveSoftware/Brave-Browser",
            "Microsoft Edge",
            "Vivaldi",
            "Arc/User Data",
        ];
        for dir in chrome {
            list.push(Browser {
                dir: support.join(dir),
                hosts: "NativeMessagingHosts",
                family: Family::Chrome,
            });
        }
        for dir in ["Mozilla", "zen"] {
            list.push(Browser {
                dir: support.join(dir),
                hosts: "NativeMessagingHosts",
                family: Family::Firefox,
            });
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let chrome = [
                "google-chrome",
                "google-chrome-beta",
                "chromium",
                "BraveSoftware/Brave-Browser",
                "microsoft-edge",
                "vivaldi",
            ];
            for dir in chrome {
                list.push(Browser {
                    dir: config.join(dir),
                    hosts: "NativeMessagingHosts",
                    family: Family::Chrome,
                });
            }
        }
        if let Some(home) = dirs::home_dir() {
            for dir in [".mozilla", ".zen"] {
                list.push(Browser {
                    dir: home.join(dir),
                    hosts: "native-messaging-hosts",
                    family: Family::Firefox,
                });
            }
        }
    }
    // Windows finds host manifests through the registry instead; that comes with Windows support.
    list
}

fn manifest(family: Family, executable: &Path) -> Value {
    let mut manifest = json!({
        "name": HOST_NAME,
        "description": "Links the Seiza browser extension to the Seiza app",
        "path": executable,
        "type": "stdio",
    });
    match family {
        Family::Chrome => {
            let origins: Vec<_> = CHROME_EXTENSION_IDS
                .iter()
                .map(|id| format!("chrome-extension://{id}/"))
                .collect();
            manifest["allowed_origins"] = json!(origins);
        }
        Family::Firefox => manifest["allowed_extensions"] = json!([FIREFOX_EXTENSION_ID]),
    }
    manifest
}

/// Writes the host manifest for every installed browser. Returns the files it wrote or
/// left as they were, and skips browsers that aren't installed.
pub fn install(executable: &Path) -> Vec<std::io::Result<PathBuf>> {
    install_into(&browsers(), executable)
}

fn install_into(browsers: &[Browser], executable: &Path) -> Vec<std::io::Result<PathBuf>> {
    browsers
        .iter()
        .filter(|browser| browser.dir.is_dir())
        .map(|browser| {
            let dir = browser.dir.join(browser.hosts);
            let file = dir.join(format!("{HOST_NAME}.json"));
            let contents = serde_json::to_string_pretty(&manifest(browser.family, executable))?;
            if std::fs::read_to_string(&file).ok().as_deref() != Some(contents.as_str()) {
                std::fs::create_dir_all(&dir)?;
                std::fs::write(&file, contents)?;
            }
            Ok(file)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_only_lock_in() {
        let chrome = manifest(Family::Chrome, Path::new("/Apps/Seiza"));
        assert_eq!(chrome["name"], HOST_NAME);
        assert_eq!(chrome["path"], "/Apps/Seiza");
        assert_eq!(
            chrome["allowed_origins"],
            json!([
                "chrome-extension://nfaamgjiehkppopelaampopbofjoepca/",
                "chrome-extension://nencjadggelocffidegejpekamaeopjc/",
            ])
        );
        assert_eq!(chrome.get("allowed_extensions"), None);

        let firefox = manifest(Family::Firefox, Path::new("/Apps/Seiza"));
        assert_eq!(firefox["allowed_extensions"], json!([FIREFOX_EXTENSION_ID]));
        assert_eq!(firefox.get("allowed_origins"), None);
    }

    #[test]
    fn installs_only_for_browsers_that_are_there() {
        let root = std::env::temp_dir().join(format!("lock-in-hosts-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("Chrome")).unwrap();
        let browsers = [
            Browser {
                dir: root.join("Chrome"),
                hosts: "NativeMessagingHosts",
                family: Family::Chrome,
            },
            Browser {
                dir: root.join("Missing"),
                hosts: "NativeMessagingHosts",
                family: Family::Firefox,
            },
        ];

        let written: Vec<_> = install_into(&browsers, Path::new("/bin/lock-in"))
            .into_iter()
            .map(Result::unwrap)
            .collect();
        let expected = root
            .join("Chrome/NativeMessagingHosts")
            .join(format!("{HOST_NAME}.json"));
        assert_eq!(written, vec![expected.clone()]);
        let saved: Value = serde_json::from_str(&std::fs::read_to_string(&expected).unwrap()).unwrap();
        assert_eq!(saved["path"], "/bin/lock-in");
        assert!(!root.join("Missing").exists());

        // Running again leaves the file alone.
        assert!(install_into(&browsers, Path::new("/bin/lock-in"))[0].is_ok());
        std::fs::remove_dir_all(root).unwrap();
    }
}
