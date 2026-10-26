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
- `src-tauri/src/session.rs`: finished sessions go into the session log with their focused time, overtime and (once idle detection lands) idle tail, so stars and stardust can be worked out from past sessions later.
- `src-tauri/src/timer.rs` and `lib.rs`: the quiet timer. When it's done it shows a quiet notification, one with a sound, or nothing at all, depending on the profile. The session keeps going either way.
- `src-tauri/src/tray.rs`: the menu-bar menu, rebuilt when the session or profiles change.
- `src/`: the window. It asks the core for a snapshot of its state and gets a new one whenever something changes (`app.ts`).
- The database lives in the app data folder (on macOS, `~/Library/Application Support/io.github.lock-in-focus-app.lock-in/`), readable by your user only.

## Icons

The app icons come from the extension's `apps/extension/icon/icon.svg`, rendered at 1024px and run through `pnpm tauri icon`. The menu-bar icon is `src-tauri/icons/tray.svg`, rendered at 44px as `tray.png`.
