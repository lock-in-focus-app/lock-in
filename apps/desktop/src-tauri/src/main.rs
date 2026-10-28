// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // A browser starts this same executable to link the extension to the app.
    let args: Vec<String> = std::env::args().collect();
    if lock_in_lib::bridge::launched_by_browser(&args) {
        std::process::exit(lock_in_lib::bridge::run());
    }
    // The system starts a copy of it as root to block sites without the extension (blocker.rs).
    #[cfg(target_os = "macos")]
    if args.iter().any(|arg| arg.starts_with("--blocker")) {
        std::process::exit(lock_in_lib::blocker::run_helper(&args));
    }
    lock_in_lib::run()
}
