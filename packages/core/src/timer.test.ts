import { describe, expect, it } from 'vitest';
import { formatClock, timerStatus } from './timer';

const min = 60_000;
const timer = { minutes: 25, onEnd: 'gentle', showSinceDone: false } as const;

describe('timerStatus', () => {
  it('counts down, then counts how long ago it finished', () => {
    expect(timerStatus({ startedAt: 0, timer }, 10 * min)).toEqual({ state: 'running', remainingMs: 15 * min });
    expect(timerStatus({ startedAt: 0, timer }, 25 * min)).toEqual({ state: 'done', sinceMs: 0 });
    expect(timerStatus({ startedAt: 0, timer }, 62 * min)).toEqual({ state: 'done', sinceMs: 37 * min });
  });

  it('just counts up without a timer', () => {
    expect(timerStatus({ startedAt: 0 }, 5 * min)).toEqual({ state: 'none', elapsedMs: 5 * min });
    expect(timerStatus({ startedAt: 0, timer: { ...timer, minutes: 0 } }, min)).toEqual({
      state: 'none',
      elapsedMs: min,
    });
    expect(timerStatus({ startedAt: 10, timer: null }, 0)).toEqual({ state: 'none', elapsedMs: 0 });
  });
});

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(245_000)).toBe('4:05');
    expect(formatClock(25 * min)).toBe('25:00');
    expect(formatClock(3_723_000)).toBe('1:02:03');
  });

  it('rounds partial seconds up', () => {
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(1)).toBe('0:01');
  });
});
