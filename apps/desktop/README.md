# Lock In — desktop app

The menu-bar app: it runs sessions and the quiet timer, and keeps a log of every session for insights and the night sky. Built with Tauri 2: a small Rust core (`src-tauri/`) and a Vue window (`src/`).

## Develop

You'll need the Rust toolchain (`rustup`) and, on macOS, the Xcode Command Line Tools. From the repo root:

```bash
pnpm dev:desktop
```

Rust tests, formatting and lints, from `src-tauri/`:

```bash
cargo test
cargo fmt
cargo clippy --all-targets -- -D warnings
```

`cargo test` also writes the TypeScript versions of the Rust types marked `#[ts(export)]` to `packages/core/src/generated/`. Commit them along with the Rust change; CI checks they match.

## How it works

- Lock In lives in the menu bar. Closing the window destroys it, webview and all, so only the Rust core keeps running, and the app has no Dock icon until the window opens again. Quit from the menu bar.
- `src-tauri/src/engine.rs`: the session engine. It owns the profiles and the running session, and saves every change to SQLite (`store.rs`) before applying it.
- `src-tauri/src/session.rs`: finished sessions go into the session log with their focused time, overtime and idle tail, so stars and stardust can be worked out from past sessions later.
- `src-tauri/src/timer.rs` and `lib.rs`: the quiet timer. When it's done it shows a quiet notification, one with a sound, or nothing at all, depending on the profile. The session keeps going either way.
- Strictness (in `timer.rs`, enforced in `engine.rs`): how hard it is to end a session before its timer is done. Gentle asks for a 10-second pause and Medium for typing out random text; both happen in the window (`EndEarly.vue`). Hard can only end early with an emergency pass (2 per week by default, each coming back 7 days after it's used). The engine enforces Hard itself, so neither the menu bar nor the browser can end such a session early.
- `src-tauri/src/idle.rs`: while a session runs, it checks once a minute how long it's been since any keyboard or mouse input, and ends the session after 15 minutes away (adjustable in Settings). The time away goes in the log as the idle tail and doesn't count. Time asleep counts as away. This works on macOS and on Linux with GNOME; Windows comes later.
- `src-tauri/src/tray.rs`: the menu-bar menu, rebuilt when the session or profiles change.
- `src-tauri/src/link.rs` and `bridge.rs`: the link to the browser extension. Browsers can only talk to a program they start themselves (Native Messaging), so they start Lock In's own executable, which notices it was started by a browser and runs as a small bridge instead of the app. The bridge passes messages to the running app over a local socket in the data folder, and waits quietly (one connect attempt every 2 seconds) while the app isn't running. Profiles and the session sync both ways; the newest change wins.
- `src-tauri/src/browsers.rs` and `processes.rs`: keeping browsers honest during a session. Each bridge tells the app which browser started it, and the app remembers that browser (Settings lists them, and can forget one between sessions). The link lasts exactly as long as the extension runs, so a remembered browser running without a link has had the extension turned off. The app and the extension each work on their own, so this only applies to sessions whose profile tames sites, and by default it only warns, after 20 seconds without a link. With "Close browsers without the extension" on in Settings, a Medium or Hard session also closes that browser a minute later, the way the system does at shutdown so it can restore its tabs, and in a Hard session the session counts as broken (kept in the log, so a broken session won't earn rewards). This works on macOS and Linux; Windows comes later.
- `src-tauri/src/apps.rs`: app rules. Each profile can list desktop apps to close or hide (macOS only) during its sessions, picked from the installed apps (app bundles on macOS, menu entries on Linux). They're kept in the profile, so they sync with the extension, which leaves them alone. A listed app goes as soon as the session starts and again if it's opened. On macOS, closing is the same as choosing Quit, so the app can save first. During a Hard session a profile's app rules can only get stricter.
- `src-tauri/src/launches.rs` and `watch_session` in `lib.rs`: the session's check on browsers and apps is event-driven. It runs when the session starts, and again when macOS says an app launched or was unhidden, when a browser links or unlinks, or when anything else changes. Between those it only waits on a timer for a browser's warning or close that's due. Linux has no way for an ordinary program to hear about new processes, so there it also checks every 10 seconds during a session (about 9 ms each). `launches.rs` is the only `unsafe` code in the app, with each promise Apple's API asks for written next to it.
- `src-tauri/src/hosts.rs`: on every launch the app writes a Native Messaging host manifest into each installed browser's folder (Chrome, Chrome for Testing, Chromium, Brave, Edge, Vivaldi, Arc, Firefox, Zen), pointing at its own executable and allowing only Lock In's extension. Windows needs registry entries instead, which come with Windows support.
- `src/`: the window. It asks the core for a snapshot of its state and gets a new one whenever something changes (`app.ts`).
- The database lives in the app data folder (on macOS, `~/Library/Application Support/io.github.lock-in-focus-app.lock-in/`), readable by your user only.

## Icons

The app icons come from the extension's `apps/extension/icon/icon.svg`, rendered at 1024px and run through `pnpm tauri icon`. The menu-bar icon is `src-tauri/icons/tray.svg`, rendered at 44px as `tray.png`.
