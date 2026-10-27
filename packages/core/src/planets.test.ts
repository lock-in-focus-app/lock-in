import { describe, expect, it } from 'vitest';
import { planets } from './planets';
import type { Star } from './sky';

const MIN = 60_000;
const HOUR = 60 * MIN;

let ids = 0;
/** A star on a day of a month in 2026 (month from 0), at 9am local time, `hours` long. */
function star(month: number, day: number, hours = 1): Star {
  const id = `star${++ids}`;
  const startedAt = new Date(2026, month, day, 9).getTime();
  return {
    id,
    profileId: 'deep-work',
    sessionIds: [id],
    startedAt,
    endedAt: startedAt + hours * HOUR,
    focusedMs: hours * HOUR,
    overtimeMs: 0,
  };
}

/** One star a day for `days` days in a row, starting on a day of a month. */
function streak(month: number, day: number, days: number, hours = 1): Star[] {
  return Array.from({ length: days }, (_, i) => star(month, day + i, hours));
}

describe('planets', () => {
  it('makes one planet for every month with focus, and none for months without', () => {
    const sky = [star(8, 30), star(9, 2), star(9, 20), star(11, 1)];
    const list = planets(sky);
    expect(list.map((p) => p.monthStart)).toEqual([
      new Date(2026, 8, 1).getTime(),
      new Date(2026, 9, 1).getTime(),
      new Date(2026, 11, 1).getTime(),
    ]);
    expect(list.map((p) => p.focusMs)).toEqual([HOUR, 2 * HOUR, HOUR]);
    expect(list[1]!.id).toBe(sky[1]!.id);
    expect(planets([])).toEqual([]);
  });

  it('counts overtime toward the month, in time order', () => {
    const late = { ...star(9, 20), overtimeMs: 30 * MIN };
    const early = star(9, 2);
    const [october] = planets([late, early]);
    expect(october!.id).toBe(early.id);
    expect(october!.focusMs).toBe(2.5 * HOUR);
  });

  it('looks the same every time, and different from month to month', () => {
    const sky = [star(8, 3), star(9, 3)];
    expect(planets(sky.map((s) => ({ ...s })))).toEqual(planets(sky));
    const [september, october] = planets(sky);
    expect(september!.colors).not.toEqual(october!.colors);
  });

  it('keeps a finished month as it was when later months come', () => {
    const september = [star(8, 3), star(8, 10, 3)];
    const [before] = planets(september);
    const [after] = planets([...september, star(9, 1), star(10, 1, 20)]);
    expect(after).toEqual(before);
  });

  it('grows as the month goes on, and gains details with more focus', () => {
    // The same month, with more and more focus.
    const first = star(9, 1);
    const month = (hours: number) => planets([{ ...first, focusedMs: hours * HOUR }])[0]!;
    const little = month(1);
    expect(little.bands).toEqual([]);
    expect(little.glow).toBe(0);
    expect(little.ring).toBe(0);
    expect(little.storm).toBeUndefined();

    const some = month(10);
    expect(some.size).toBeGreaterThan(little.size);
    expect(some.bands.length).toBeGreaterThan(0);
    expect(some.glow).toBeGreaterThan(0);
    expect(some.ring).toBe(0);

    const lots = month(25);
    expect(lots.ring).toBeGreaterThan(0);
    expect(lots.bands.length).toBeGreaterThan(some.bands.length);
    // The bands it had stay where they were.
    expect(lots.bands.slice(0, some.bands.length)).toEqual(some.bands);
    expect(lots.colors).toEqual(some.colors);

    const most = month(80);
    expect(most.size).toBe(1);
    expect(most.ring).toBe(1);
    expect(most.glow).toBe(1);
    expect(most.outerRing).toBe(1);
    expect(most.storm?.strength).toBe(1);
    expect(most.bands.length).toBeLessThanOrEqual(6);
  });
});

describe('moons', () => {
  it('earns a moon when a streak reaches 3, 7 and 14 days, around that month’s planet', () => {
    const moons = (days: number) => planets(streak(9, 1, days))[0]!.moons.map((m) => m.streakDays);
    expect(moons(2)).toEqual([]);
    expect(moons(3)).toEqual([3]);
    expect(moons(7)).toEqual([3, 7]);
    expect(moons(14)).toEqual([3, 7, 14]);
  });

  it('counts a day once, however many times you focus that day', () => {
    const sky = [...streak(9, 1, 2), star(9, 2), star(9, 2)];
    expect(planets(sky)[0]!.moons).toEqual([]);
  });

  it('never takes a moon away for a missed day', () => {
    const first = streak(9, 1, 3);
    const before = planets(first)[0]!.moons;
    // A missed day, then a short streak.
    const after = planets([...first, ...streak(9, 5, 2)])[0]!.moons;
    expect(after).toEqual(before);
    // Each streak earns its own.
    expect(planets([...first, ...streak(9, 5, 3)])[0]!.moons.map((m) => m.streakDays)).toEqual([3, 3]);
  });

  it('keeps at most three moons for a planet', () => {
    const sky = [...streak(9, 1, 3), ...streak(9, 5, 3), ...streak(9, 9, 3), ...streak(9, 13, 3)];
    expect(planets(sky)[0]!.moons).toHaveLength(3);
  });

  it('gives a streak across months its moons in the month each was earned', () => {
    // 30 September to 7 October: 3 days on 2 October, 7 days on 6 October.
    const [september, october] = planets(streak(8, 30, 8));
    expect(september!.moons).toEqual([]);
    expect(october!.moons.map((m) => m.streakDays)).toEqual([3, 7]);
    expect(october!.moons[0]!.earnedOn).toBe(new Date(2026, 9, 2).getTime());
  });

  it('keeps earning moons every week of a long streak', () => {
    // Every day from 1 October to 28 November.
    const days = streak(9, 1, 59);
    const [october, november] = planets(days);
    expect(october!.moons.map((m) => m.streakDays)).toEqual([3, 7, 14]);
    // 35, 42, 49 and 56 days fall in November; the first three are kept.
    expect(november!.moons.map((m) => m.streakDays)).toEqual([35, 42, 49]);
  });

  it('counts days in a row across a daylight saving change', () => {
    // Clocks change on 25 October in Europe and 1 November in the US and Canada.
    expect(planets(streak(9, 24, 3))[0]!.moons).toHaveLength(1);
    expect(planets(streak(9, 31, 3))[1]!.moons).toHaveLength(1);
  });

  it('gives moons their own orbits, further out each time', () => {
    const [october] = planets(streak(9, 1, 14));
    const orbits = october!.moons.map((m) => m.orbit);
    expect(orbits).toEqual([...orbits].sort((a, b) => a - b));
    expect(new Set(october!.moons.map((m) => m.id)).size).toBe(3);
  });
});
