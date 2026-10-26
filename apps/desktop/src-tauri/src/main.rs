// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // A browser starts this same executable to link the extension to the app.
    let args: Vec<String> = std::env::args().collect();
    if lock_in_lib::bridge::launched_by_browser(&args) {
        std::process::exit(lock_in_lib::bridge::run());
    }
    lock_in_lib::run()
}
