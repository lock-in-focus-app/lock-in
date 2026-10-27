//! How long it's been since the last keyboard or mouse input, so a session left running while
//! you're away ends by itself and the time away isn't counted.

/// Milliseconds since the last keyboard or mouse input, or None where the system can't say.
#[cfg(target_os = "macos")]
pub fn system_idle_ms() -> Option<i64> {
    use objc2_core_graphics::{CGEventSource, CGEventSourceStateID, CGEventType};
    // kCGAnyInputEventType: input of any kind.
    let any_input = CGEventType(u32::MAX);
    let seconds = CGEventSource::seconds_since_last_event_type(CGEventSourceStateID::HIDSystemState, any_input);
    (seconds.is_finite() && seconds >= 0.0).then_some((seconds * 1000.0) as i64)
}

/// Milliseconds since the last keyboard or mouse input, or None where the system can't say.
/// This asks GNOME's idle monitor; other Linux desktops don't have a dependable one yet.
#[cfg(target_os = "linux")]
pub fn system_idle_ms() -> Option<i64> {
    let connection = zbus::blocking::Connection::session().ok()?;
    let reply = connection
        .call_method(
            Some("org.gnome.Mutter.IdleMonitor"),
            "/org/gnome/Mutter/IdleMonitor/Core",
            Some("org.gnome.Mutter.IdleMonitor"),
            "GetIdletime",
            &(),
        )
        .ok()?;
    let ms: u64 = reply.body().deserialize().ok()?;
    i64::try_from(ms).ok()
}

/// Windows support comes later, with the rest of the Windows version.
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn system_idle_ms() -> Option<i64> {
    None
}

/// How often a running session checks for idle time.
pub const CHECK_EVERY_MS: i64 = 60_000;

/// Keeps track of when the last input was (epoch ms), from a reading of the system's idle time
/// each check.
///
/// The system's idle time may not count time asleep, and waking the computer is itself input.
/// So when the clock has jumped well past a check's interval, the computer was asleep, and the
/// last input stays the one from before it went to sleep.
pub struct IdleWatch {
    last_input: i64,
    last_check: i64,
}

impl IdleWatch {
    pub fn new(now: i64, idle_ms: i64) -> Self {
        Self {
            last_input: now - idle_ms,
            last_check: now,
        }
    }

    /// Takes a new reading and returns when the last input was.
    pub fn check(&mut self, now: i64, idle_ms: i64) -> i64 {
        let slept = now - self.last_check > 2 * CHECK_EVERY_MS;
        if !slept {
            self.last_input = self.last_input.max(now - idle_ms);
        }
        self.last_check = now;
        self.last_input
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIN: i64 = 60_000;

    #[test]
    fn follows_the_last_input() {
        let mut watch = IdleWatch::new(0, 0);
        assert_eq!(watch.check(MIN, 10_000), MIN - 10_000);
        assert_eq!(watch.check(2 * MIN, 2 * MIN), MIN - 10_000);
        assert_eq!(watch.check(3 * MIN, 0), 3 * MIN);
    }

    #[test]
    fn counts_time_asleep_as_away() {
        let mut watch = IdleWatch::new(0, 5_000);
        // Asleep for an hour; the key press that woke it is ignored.
        assert_eq!(watch.check(60 * MIN, 1_000), -5_000);
        // Input after that counts again.
        assert_eq!(watch.check(61 * MIN, 0), 61 * MIN);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn reads_the_system_idle_time() {
        assert!(system_idle_ms().is_some_and(|ms| ms >= 0));
    }
}
