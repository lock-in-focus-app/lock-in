import type { Strictness } from './generated/Strictness';
import type { TimerSettings } from './generated/TimerSettings';

/** Where a session's quiet timer is: counting down, done, or not set. */
export type TimerStatus =
  { state: 'none'; elapsedMs: number } | { state: 'running'; remainingMs: number } | { state: 'done'; sinceMs: number };

/** The timer's state for a session that started at `startedAt`. */
export function timerStatus(session: { startedAt: number; timer?: TimerSettings | null }, now: number): TimerStatus {
  const elapsedMs = Math.max(0, now - session.startedAt);
  const minutes = session.timer?.minutes ?? 0;
  if (minutes <= 0) return { state: 'none', elapsedMs };
  const remainingMs = minutes * 60_000 - elapsedMs;
  return remainingMs > 0 ? { state: 'running', remainingMs } : { state: 'done', sinceMs: elapsedMs - minutes * 60_000 };
}

/** A duration as a clock: "4:05", "25:00" or "1:02:03". Seconds round up, so a countdown never shows 0:00 early. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * How hard it is to end a session at `now`: its strictness while the timer is running, and
 * nothing once it's done or if there's no timer. The desktop app's `Session::lock` does the same.
 */
export function endLock(
  session: { startedAt: number; timer?: TimerSettings | null },
  now: number,
): Strictness | undefined {
  if (timerStatus(session, now).state !== 'running') return undefined;
  return session.timer?.strictness ?? 'gentle';
}

// No 0/O, 1/l/I or 5/S, so the text can be read and typed without guessing.
const unlockAlphabet = 'abcdefghijkmnpqrtuvwxyzABCDEFGHJKLMNPQRTUVWXYZ2346789';

/** Random text to type out to end a Medium session early, in groups of five. */
export function unlockText(groups = 6): string {
  const values = crypto.getRandomValues(new Uint32Array(groups * 5));
  const chars = Array.from(values, (v) => unlockAlphabet[v % unlockAlphabet.length]);
  return Array.from({ length: groups }, (_, i) => chars.slice(i * 5, i * 5 + 5).join('')).join(' ');
}
