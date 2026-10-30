// The satellite box's hotkey, which can be changed in Settings. It's saved as text like
// "Alt+KeyP": the modifiers, then the key by its name in the web's `KeyboardEvent.code`, which
// is what the Settings page records and what the global shortcut plugin reads.

use std::fmt;
use std::str::FromStr;

use tauri_plugin_global_shortcut::{Modifiers, Shortcut};

pub const DEFAULT_HOTKEY: &str = "Alt+KeyP";

/// Shortcuts the system or the window manager already uses, which a global hotkey would take
/// away from it. Written as `text` writes them.
const RESERVED: &[&str] = &[
    // Switching apps and windows, and closing them, on Windows and Linux.
    "Alt+Tab",
    "Alt+Shift+Tab",
    "Alt+Escape",
    "Alt+Space",
    "Alt+F4",
    "Control+Alt+Delete",
    "Control+Shift+Escape",
    // Force Quit, locking the screen, logging out, full screen, emoji and screenshots on a Mac.
    "Alt+Super+Escape",
    "Control+Super+KeyQ",
    "Shift+Super+KeyQ",
    "Control+Super+KeyF",
    "Control+Super+Space",
    "Shift+Super+Digit3",
    "Shift+Super+Digit4",
    "Shift+Super+Digit5",
];

/// Why a hotkey can't be used.
#[derive(Debug, PartialEq, Eq)]
pub enum Problem {
    Unreadable,
    /// Command+C and the like belong to other apps.
    NeedsModifiers,
    Reserved,
    /// Another app registered it first.
    Taken,
}

impl fmt::Display for Problem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (alt, two) = if cfg!(target_os = "macos") {
            ("Option", "Control, Shift and Command")
        } else {
            ("Alt", "Control, Shift and the Windows key")
        };
        match self {
            Problem::Unreadable => f.write_str("that isn't a key Seiza can listen for"),
            Problem::NeedsModifiers => write!(
                f,
                "a hotkey needs {alt}, or two of {two}, so it doesn't take a shortcut other apps use"
            ),
            Problem::Reserved => f.write_str("the system already uses that one"),
            Problem::Taken => f.write_str("another app is already using that one"),
        }
    }
}

/// Reads a saved or recorded hotkey, if it's one that can be used.
pub fn parse(hotkey: &str) -> Result<Shortcut, Problem> {
    let shortcut = Shortcut::from_str(hotkey).map_err(|_| Problem::Unreadable)?;
    let held = [Modifiers::CONTROL, Modifiers::SHIFT, Modifiers::SUPER]
        .into_iter()
        .filter(|&modifier| shortcut.mods.contains(modifier))
        .count();
    if !shortcut.mods.contains(Modifiers::ALT) && held < 2 {
        return Err(Problem::NeedsModifiers);
    }
    if RESERVED.contains(&text(&shortcut).as_str()) {
        return Err(Problem::Reserved);
    }
    Ok(shortcut)
}

/// A hotkey as it's saved, with the modifiers always in the same order (the order a Mac shows
/// them in: ⌃⌥⇧⌘).
pub fn text(shortcut: &Shortcut) -> String {
    let names = [
        (Modifiers::CONTROL, "Control+"),
        (Modifiers::ALT, "Alt+"),
        (Modifiers::SHIFT, "Shift+"),
        (Modifiers::SUPER, "Super+"),
    ];
    let mut text: String = names
        .into_iter()
        .filter(|(modifier, _)| shortcut.mods.contains(*modifier))
        .map(|(_, name)| name)
        .collect();
    text.push_str(&shortcut.key.to_string());
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_hotkeys_and_writes_them_the_same_way_each_time() {
        assert_eq!(text(&parse(DEFAULT_HOTKEY).unwrap()), DEFAULT_HOTKEY);
        assert_eq!(text(&parse("Super+Shift+KeyK").unwrap()), "Shift+Super+KeyK");
        assert_eq!(text(&parse("ctrl+alt+Digit1").unwrap()), "Control+Alt+Digit1");
        assert_eq!(text(&parse("Control+Super+ArrowUp").unwrap()), "Control+Super+ArrowUp");
    }

    #[test]
    fn leaves_other_apps_their_shortcuts() {
        for hotkey in ["Super+KeyC", "Control+Space", "Shift+KeyP", "KeyP", "F5"] {
            assert_eq!(parse(hotkey).unwrap_err(), Problem::NeedsModifiers, "{hotkey}");
        }
        for hotkey in ["Alt+Tab", "Super+Alt+Escape", "Shift+Super+Digit4"] {
            assert_eq!(parse(hotkey).unwrap_err(), Problem::Reserved, "{hotkey}");
        }
    }

    #[test]
    fn turns_away_what_isnt_a_hotkey() {
        for hotkey in ["", "Alt+", "Alt+Banana", "Alt+KeyP+KeyQ", "Alt+KeyP; rm -rf"] {
            assert_eq!(parse(hotkey).unwrap_err(), Problem::Unreadable, "{hotkey:?}");
        }
    }
}
