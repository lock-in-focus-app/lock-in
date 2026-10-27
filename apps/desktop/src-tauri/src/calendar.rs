//! The first day of the week as set on this computer, so the weekly report's weeks start on it.

/// The first day of the week from System Settings, 0 being Sunday as in JavaScript.
#[cfg(target_os = "macos")]
pub fn first_weekday() -> Option<u8> {
    // Counted from 1, for Sunday. The current calendar follows the Language & Region settings.
    let day = objc2_foundation::NSCalendar::currentCalendar().firstWeekday();
    (1..=7).contains(&day).then(|| (day - 1) as u8)
}

/// Elsewhere there's no setting to read, so the window uses its language's default.
#[cfg(not(target_os = "macos"))]
pub fn first_weekday() -> Option<u8> {
    None
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    #[test]
    fn reads_the_first_day_of_the_week() {
        assert!(super::first_weekday().is_some_and(|day| day < 7));
    }
}
