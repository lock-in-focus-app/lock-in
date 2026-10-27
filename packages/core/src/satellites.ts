import type { Satellite } from './generated/Satellite';
import type { SatelliteAction } from './generated/SatelliteAction';
import type { SatelliteState } from './generated/SatelliteState';

// Satellites kept by the extension when it runs without the desktop app. The rules match the
// app's (satellites.rs and the engine), so a satellite behaves the same wherever it was launched.

/** The longest satellite kept, as in satellites.rs. */
export const maxSatelliteLength = 500;

/** How long a ticked-off task stays on the list, so one ticked by accident can be unticked. */
export const doneTasksShownMs = 24 * 60 * 60_000;

/** The text worth keeping from what was typed, or undefined if there's nothing there. */
export function cleanedSatelliteText(text: string): string | undefined {
  // Counted in code points, as Rust counts chars, so both sides cut at the same place.
  const cleaned = Array.from(text.trim()).slice(0, maxSatelliteLength).join('').trimEnd();
  return cleaned || undefined;
}

/**
 * Launches a thought into orbit, to come back when the running session ends, or the next one
 * if none is running. Empty thoughts aren't launched.
 */
export function withSatelliteLaunched(list: readonly Satellite[], id: string, text: string, now: number): Satellite[] {
  const cleaned = cleanedSatelliteText(text);
  if (!cleaned) return [...list];
  return [...list, { id, text: cleaned, launchedAt: now, state: 'orbiting', stateAt: now }];
}

/** Brings the satellites in orbit back, when a session ends. */
export function withSatellitesBack(list: readonly Satellite[], now: number): Satellite[] {
  return list.map((s) => (s.state === 'orbiting' ? { ...s, state: 'back', stateAt: now } : s));
}

const actionStates: Record<SatelliteAction, SatelliteState> = {
  done: 'done',
  snooze: 'orbiting',
  task: 'task',
  delete: 'deleted',
};

/**
 * Ticks off, snoozes, keeps as a task or deletes a satellite. Only tasks stay once ticked off,
 * and only for a day; the rest are dropped, since the extension keeps no insights of its own.
 */
export function withSatelliteAction(
  list: readonly Satellite[],
  id: string,
  action: SatelliteAction,
  now: number,
): Satellite[] {
  const wasTask = list.find((s) => s.id === id)?.state === 'task';
  return list
    .map((s) => (s.id === id ? { ...s, state: actionStates[action], stateAt: now } : s))
    .filter((s) => {
      if (s.state === 'done') return s.id === id ? wasTask : s.stateAt >= now - doneTasksShownMs;
      return s.state !== 'deleted';
    });
}
