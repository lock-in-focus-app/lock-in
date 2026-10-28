import { describe, expect, it } from 'vitest';
import {
  cleanedConstellationName,
  constellationNames,
  constellations,
  maxConstellationNameLength,
  skyPlaces,
} from './constellations';
import { weekStart } from './insights';
import type { Star } from './sky';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
// Monday 26 October 2026, 9am local time.
const monday = new Date(2026, 9, 26, 9).getTime();

let ids = 0;
/** A 40-minute star starting `days` after Monday 9am. */
function star(days: number, extra: Partial<Star> = {}): Star {
  const id = `star${++ids}`;
  const startedAt = monday + days * DAY;
  return {
    id,
    profileId: 'deep-work',
    sessionIds: [id],
    startedAt,
    endedAt: startedAt + 40 * MIN,
    focusedMs: 40 * MIN,
    overtimeMs: 0,
    ...extra,
  };
}

describe('constellations', () => {
  it('makes one constellation per week, starting on the first day of the week', () => {
    const sky = [star(0), star(2.2), star(6), star(7), star(15)];
    const mondays = constellations(sky, 1);
    expect(mondays.map((c) => c.stars.length)).toEqual([3, 1, 1]);
    expect(mondays.map((c) => c.weekStart)).toEqual([
      weekStart(monday, 1),
      weekStart(monday + 7 * DAY, 1),
      weekStart(monday + 15 * DAY, 1),
    ]);
    expect(mondays[0]!.id).toBe(sky[0]!.id);

    // Weeks starting on Sunday put Sunday's star with the next week's.
    const sundays = constellations(sky, 0);
    expect(sundays.map((c) => c.stars.length)).toEqual([2, 2, 1]);
  });

  it('keeps a week with gaps as one constellation, in time order', () => {
    const late = star(5);
    const early = star(0);
    const [week] = constellations([late, early]);
    expect(week!.stars.map((s) => s.id)).toEqual([early.id, late.id]);
  });

  it('places each star in its day of the week, the same way every time', () => {
    const sky = Array.from({ length: 7 }, (_, day) => star(day));
    const [week] = constellations(sky);
    const [again] = constellations(sky.map((s) => ({ ...s })));
    expect(again).toEqual(week);
    week!.points.forEach((point, day) => {
      expect(point.x).toBeGreaterThanOrEqual(-1 + (2 / 7) * day);
      expect(point.x).toBeLessThanOrEqual(-1 + (2 / 7) * (day + 1));
      expect(Math.abs(point.y)).toBeLessThanOrEqual(0.5);
    });
  });

  it('keeps a star where it is as more stars join the week', () => {
    const first = star(1);
    const [before] = constellations([first]);
    const [after] = constellations([first, star(1.1), star(3)]);
    expect(after!.points[0]).toEqual(before!.points[0]);
    expect(after!.id).toBe(before!.id);
  });

  it('joins every star with the fewest, shortest lines', () => {
    const sky = Array.from({ length: 12 }, (_, i) => star(i * 0.5));
    const [week] = constellations(sky);
    expect(week!.lines).toHaveLength(11);
    // Every star is reached.
    const reached = new Set(week!.lines.flat());
    expect(reached.size).toBe(12);
    expect(constellations([star(0)])[0]!.lines).toEqual([]);
  });

  it('hands back the same constellations for weeks that haven’t changed', () => {
    const sky = [star(0), star(1), star(7), star(8)];
    const before = constellations(sky);
    // A session going on this week: its star grows.
    const growing = { ...sky[3]!, endedAt: sky[3]!.endedAt + MIN, focusedMs: sky[3]!.focusedMs + MIN };
    const after = constellations(
      [...sky.slice(0, 3), growing].map((s) => ({ ...s })),
      1,
      before,
    );
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]!.stars[1]!.focusedMs).toBe(growing.focusedMs);
    expect(after).toEqual(constellations([...sky.slice(0, 3), growing]));
  });
});

describe('skyPlaces', () => {
  it('puts the newest in the middle, with none overlapping', () => {
    const places = skyPlaces(120);
    const newest = places[places.length - 1]!;
    expect(Math.hypot(newest.x, newest.y)).toBeLessThan(1.5);
    // Each constellation spans 2 across and a little over 1 down, with its name beneath.
    for (let i = 0; i < places.length; i++) {
      for (let j = 0; j < i; j++) {
        const overlaps = Math.abs(places[i]!.x - places[j]!.x) < 2.3 && Math.abs(places[i]!.y - places[j]!.y) < 1.6;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('keeps the newest in the middle as weeks go by', () => {
    expect(skyPlaces(5)[4]).toEqual(skyPlaces(1)[0]);
    // Last week's moves out one place.
    expect(skyPlaces(5)[3]).toEqual(skyPlaces(2)[0]);
  });
});

describe('constellationNames', () => {
  const list = constellations(Array.from({ length: 30 }, (_, i) => star(i * 7)));

  it('makes up a name for each, the same every time and none the same', () => {
    const names = constellationNames(list);
    expect(names).toEqual(constellationNames(list));
    expect(new Set(names).size).toBe(30);
    for (const name of names) expect(name).toMatch(/^The [A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('uses the names people gave them, and skips them when making names up', () => {
    const made = constellationNames(list);
    const saved = new Map([
      [list[3]!.id, 'Exam week'],
      [list[4]!.id, made[0]!],
    ]);
    const names = constellationNames(list, saved);
    expect(names[3]).toBe('Exam week');
    expect(names[4]).toBe(made[0]);
    expect(names[0]).not.toBe(made[0]);
    expect(new Set(names).size).toBe(30);
  });
});

describe('cleanedConstellationName', () => {
  it('trims, keeps it on one line and cuts it down', () => {
    expect(cleanedConstellationName('  The   Big\nDipper ')).toBe('The Big Dipper');
    expect(cleanedConstellationName(' \n ')).toBeUndefined();
    expect(Array.from(cleanedConstellationName('é'.repeat(60))!)).toHaveLength(maxConstellationNameLength);
  });
});
