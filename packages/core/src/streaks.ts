import type { Star } from './sky';

// Streaks: days in a row with a star, in local time. Moons, personal bests and the weekly report
// all count them the same way. A missed day starts a new streak; nothing is ever lost or shown as
// broken.

/** A day with at least one star, and how far into a streak of days in a row it is. */
export interface StarDay {
  /** The day's first star. */
  id: string;
  /** Midnight at its start, local time (epoch ms). */
  day: number;
  /** How many days in a row with a star it makes, itself included. */
  streakDays: number;
  /** The streak's first star. */
  streakId: string;
}

/** Each day with a star, oldest first. A star counts on the day it started. */
export function starDays(sky: readonly Star[]): StarDay[] {
  const days: StarDay[] = [];
  for (const star of [...sky].sort((a, b) => a.startedAt - b.startedAt)) {
    const day = dayStart(star.startedAt);
    const last = days[days.length - 1];
    if (last?.day === day) continue;
    const continues = last && day === nextDay(last.day);
    days.push({
      id: star.id,
      day,
      streakDays: continues ? last.streakDays + 1 : 1,
      streakId: continues ? last.streakId : star.id,
    });
  }
  return days;
}

export interface Streaks {
  /**
   * Days in a row with a star up to `at`, if the streak is still running: its last day is that day
   * or the one before, since that day isn't over. Otherwise 0.
   */
  current: number;
  /** The most days in a row with a star by `at`. */
  longest: number;
}

/** The streak running at `at` (epoch ms), and the longest by then, from stars that started before it. */
export function streaks(sky: readonly Star[], at: number): Streaks {
  const days = starDays(sky.filter((star) => star.startedAt <= at));
  const last = days[days.length - 1];
  const today = dayStart(at);
  const running = last && (last.day === today || nextDay(last.day) === today);
  return {
    current: running ? last.streakDays : 0,
    longest: Math.max(0, ...days.map((day) => day.streakDays)),
  };
}

export function dayStart(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The start of the day after the one starting at `day`, even across a daylight saving change. */
export function nextDay(day: number): number {
  const date = new Date(day);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}
