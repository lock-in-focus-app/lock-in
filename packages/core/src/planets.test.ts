import { describe, expect, it } from 'vitest';
import { planetKinds, planets, type Planet, type PlanetKind } from './planets';
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

  it('looks the same every time, and never the same kind of world two months running', () => {
    const sky = Array.from({ length: 24 }, (_, i) => star(i, 3));
    expect(planets(sky.map((s) => ({ ...s })))).toEqual(planets(sky));
    const kinds = planets(sky).map((p) => p.kind);
    kinds.slice(1).forEach((kind, i) => expect(kind).not.toBe(kinds[i]));
    expect(new Set(kinds)).toEqual(new Set(planetKinds));
  });

  it('keeps a finished month as it was when later months come', () => {
    const september = [star(8, 3), star(8, 10, 3)];
    const [before] = planets(september);
    const [after] = planets([...september, star(9, 1), star(10, 1, 20)]);
    expect(after).toEqual(before);
  });

  it('takes shape as the month goes on: dust, then a lumpy rock, then a round world', () => {
    const month = october();
    const dust = month(1);
    expect(dust.form).toBe('dust');
    expect(dust.dust).toBe(1);
    expect(dust.features).toEqual([]);

    const lumpy = month(6);
    expect(lumpy.form).toBe('lumpy');
    expect(lumpy.dust).toBe(0);
    expect(lumpy.lumpiness).toBeGreaterThan(0);
    expect(lumpy.lumpiness).toBeLessThan(dust.lumpiness);

    const round = month(12);
    expect(round.form).toBe('round');
    expect(round.lumpiness).toBe(0);
    expect(round.size).toBeGreaterThan(lumpy.size);
    expect(round.colors).toEqual(dust.colors);
    expect(round.outline).toEqual(dust.outline);
  });

  it('gains its kind’s surface, rings, an atmosphere and an aurora with more focus', () => {
    for (const kind of planetKinds) {
      const month = october(kind);
      const round = month(12);
      expect(round.rings).toEqual([]);
      expect(round.glow).toBe(0);
      if (kind === 'gas') expect(round.bands.length).toBeGreaterThan(0);
      else expect(round.features.length).toBeGreaterThan(0);

      const ringed = month(25);
      expect(ringed.rings).toHaveLength(1);
      // What it had stays where it was.
      expect(ringed.features.slice(0, round.features.length)).toEqual(round.features);
      expect(ringed.bands.slice(0, round.bands.length)).toEqual(round.bands);

      const most = month(80);
      expect(most.size).toBe(1);
      expect(most.glow).toBe(1);
      expect(most.aurora).toBe(1);
      expect(most.flattening).toBe(1);
      expect(most.rings.every((ring) => ring.amount === 1)).toBe(true);
      expect(most.features.length).toBeLessThanOrEqual(8);
      expect(most.bands.length).toBeLessThanOrEqual(6);
      expect(most.caps > 0).toBe(kind === 'ice' || kind === 'rocky' || kind === 'ocean');
      expect(most.storm?.strength).toBe(kind === 'gas' ? 1 : undefined);
    }
  });

  it('gives each planet a ring style of its own, and a second ring crossing the first', () => {
    const styles = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const month = october(undefined, `ring${i}`);
      const [first] = month(25).rings;
      styles.add(first!.style);
      const later = month(50).rings;
      if (first!.style === 'stacked') {
        // Stacked rings get more layers instead.
        expect(later).toHaveLength(1);
        expect(later[0]!.layers).toBeGreaterThan(first!.layers);
      } else {
        expect(later).toHaveLength(2);
        expect(later[0]!.tilt).toBe(first!.tilt);
        expect(Math.abs(later[1]!.tilt - first!.tilt)).toBeGreaterThan(0.4);
      }
    }
    expect(styles).toEqual(new Set(['single', 'stacked', 'halo', 'clumpy']));
  });

  it('remembers the profile with the most focus in the month, to tint it', () => {
    const sky = [star(9, 1, 2), { ...star(9, 2), profileId: 'writing' }, { ...star(9, 3, 1.5), profileId: 'writing' }];
    expect(planets(sky)[0]!.topProfileId).toBe('writing');
    expect(planets(sky.slice(0, 2))[0]!.topProfileId).toBe('deep-work');
  });
});

/**
 * A month in October 2026 with `hours` of focus, always with the same first star, so only the
 * hours change. With `kind`, it's a month whose planet is that kind of world.
 */
function october(kind?: PlanetKind, seed = 'october'): (hours: number) => Planet {
  const first = star(9, 1);
  const month = (id: string) => (hours: number) => planets([{ ...first, id, focusedMs: hours * HOUR }])[0]!;
  for (let i = 0; ; i++) {
    const id = `${seed}${i}`;
    if (!kind || month(id)(1).kind === kind) return month(id);
  }
}

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
