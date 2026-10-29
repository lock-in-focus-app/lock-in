// Sample data for trying the app in development builds: six weeks of made-up sessions and
// trips to redirected sites, so the night sky and the weekly report have something to show.
// Every id starts with `sample-`, so they can all be removed again without touching real ones.

use crate::session::{EndReason, GateVisit, SessionRecord};

pub const SAMPLE_PREFIX: &str = "sample-";

const MIN: i64 = 60_000;
const DAY: i64 = 24 * 60 * MIN;
const DAYS: i64 = 42;

/// Random enough for sample data (xorshift), so no extra crate is needed.
struct Random(u64);

impl Random {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// A whole number from 0 up to (not including) `below`.
    fn below(&mut self, below: u64) -> u64 {
        self.next() % below
    }

    fn chance(&mut self, percent: u64) -> bool {
        self.below(100) < percent
    }

    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len() as u64) as usize]
    }
}

/// Sessions and gate visits for the six weeks before `now`, spread over the given profiles
/// (id, name). Some days are left empty, as real ones would be.
pub fn sample_log(now: i64, profiles: &[(String, String)]) -> (Vec<SessionRecord>, Vec<GateVisit>) {
    let mut random = Random(now as u64 | 1);
    let mut sessions = Vec::new();
    let mut visits = Vec::new();
    if profiles.is_empty() {
        return (sessions, visits);
    }
    // Midnight UTC is close enough for made-up days; times within them still vary.
    let today = now - now.rem_euclid(DAY);
    for day in (1..=DAYS).rev() {
        let midnight = today - day * DAY;
        if random.chance(20) {
            continue;
        }
        let mut at = midnight + (8 * 60 + random.below(4 * 60) as i64) * MIN;
        for _ in 0..=random.below(3) {
            let (profile_id, profile_name) = random.pick(profiles);
            let timer = *random.pick(&[25, 45, 50]);
            let minutes = *random.pick(&[8, 20, 25, 40, 45, 50, 60, 90]) as i64;
            let idle = random.chance(10);
            let focused = minutes.min(timer);
            let ended_at = at + (minutes + if idle { 10 } else { 0 }) * MIN;
            if ended_at > now {
                break;
            }
            sessions.push(SessionRecord {
                id: format!("{SAMPLE_PREFIX}{}", random.next()),
                profile_id: profile_id.clone(),
                profile_name: profile_name.clone(),
                started_at: at,
                ended_at,
                timer_minutes: Some(timer as u32),
                focused_ms: focused * MIN,
                overtime_ms: (minutes - focused) * MIN,
                idle_tail_ms: if idle { 10 * MIN } else { 0 },
                end_reason: if idle { EndReason::Idle } else { EndReason::Stopped },
                broken: false,
                goal: None,
                goal_met: None,
            });
            // Sometimes another short one right after, which shares its star.
            let gap = if minutes < 30 && random.chance(40) {
                5
            } else {
                30 + random.below(180) as i64
            };
            at += (minutes + gap) * MIN;
        }
        for _ in 0..random.below(5) {
            visits.push(GateVisit {
                id: format!("{SAMPLE_PREFIX}{}", random.next()),
                recipe_id: random.pick(&["reddit", "youtube", "x", "instagram"]).to_string(),
                at: midnight + (9 * 60 + random.below(13 * 60) as i64) * MIN,
                destination: Some("gate".into()),
                why: random
                    .chance(70)
                    .then(|| random.pick(&["stuck", "bored", "tired", "curious"]).to_string()),
                intention: None,
                continued: random.chance(30),
            });
        }
    }
    (sessions, visits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn makes_six_weeks_of_marked_samples() {
        let now = 1_800_000_000_000;
        let profiles = [("writing".to_string(), "Writing".to_string())];
        let (sessions, visits) = sample_log(now, &profiles);
        assert!(sessions.len() > 20);
        assert!(
            sessions
                .iter()
                .all(|s| s.id.starts_with(SAMPLE_PREFIX) && s.profile_id == "writing")
        );
        assert!(visits.iter().all(|v| v.id.starts_with(SAMPLE_PREFIX)));
        assert!(
            sessions
                .iter()
                .all(|s| s.started_at >= now - 43 * DAY && s.ended_at < now)
        );
        assert!(sample_log(now, &[]).0.is_empty());
    }
}
