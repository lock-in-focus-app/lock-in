import { describe, expect, it } from 'vitest';
import { comets, rareEvents, type RareEvent } from './events';
import type { GateVisitRecord } from './generated/GateVisitRecord';
import type { SessionRecord } from './generated/SessionRecord';
import { planets } from './planets';
import { stars } from './sky';

const MIN = 60_000;
const HOUR = 60 * MIN;

let ids = 0;
/** A session on a day of October 2026 (or later, past 31), at `hour` local time, `hours` long. */
function session(day: number, hours = 1, hour = 9, extra: Partial<SessionRecord> = {}): SessionRecord {
  const id = `s${++ids}`;
  const startedAt = new Date(2026, 9, day, hour).getTime();
  return {
    id,
    profileId: 'deep-work',
    profileName: 'Deep Work',
    startedAt,
    endedAt: startedAt + hours * HOUR,
    timerMinutes: null,
    focusedMs: hours * HOUR,
    overtimeMs: 0,
    idleTailMs: 0,
    endReason: 'stopped',
    broken: false,
    ...extra,
  };
}

/** A trip to a site on a day of October 2026, at `hour` local time. */
function visit(day: number, hour: number, recipeId = 'reddit', continued = false): GateVisitRecord {
  return {
    id: `v${++ids}`,
    recipeId,
    at: new Date(2026, 9, day, hour).getTime(),
    destination: 'gate',
    why: null,
    intention: null,
    continued,
  };
}

const secrets = (count: number) => Array.from({ length: count }, (_, i) => `secret${i}`);

describe('comets', () => {
  it('rolls only for the first trip to each site each day that went back to focus', () => {
    const trips = [
      visit(1, 9, 'reddit', true),
      visit(1, 10),
      visit(1, 11),
      visit(1, 12),
      visit(1, 13, 'youtube'),
      visit(2, 9),
    ];
    const counted = new Set([trips[1]!.id, trips[4]!.id, trips[5]!.id]);
    let found = 0;
    for (const secret of secrets(400)) {
      const list = comets(trips, secret);
      for (const comet of list) expect(counted).toContain(comet.id);
      found += list.length;
    }
    // About one in four of the three that count.
    expect(found / (400 * 3)).toBeGreaterThan(0.2);
    expect(found / (400 * 3)).toBeLessThan(0.3);
  });

  it('looks the same for the same secret, and differs for another', () => {
    const trips = Array.from({ length: 40 }, (_, i) => visit(1 + (i % 28), 10, `site${i}`));
    expect(comets([...trips].reverse(), 'a')).toEqual(comets(trips, 'a'));
    expect(comets(trips, 'b')).not.toEqual(comets(trips, 'a'));
    for (const comet of comets(trips, 'a')) {
      expect(Math.abs(comet.x)).toBeLessThanOrEqual(0.9);
      expect(Math.abs(comet.y)).toBeLessThanOrEqual(0.4);
    }
  });
});

describe('rare events', () => {
  it('is the same for the same log and secret, and differs for another secret', () => {
    const log = Array.from({ length: 200 }, (_, i) => session(1 + i * 2, 2));
    const events = rareEvents(log, 'a');
    expect(events.length).toBeGreaterThan(0);
    expect(rareEvents([...log].reverse(), 'a')).toEqual(events);
    expect(rareEvents(log, 'b')).not.toEqual(events);
  });

  it('never changes what already happened as the log grows', () => {
    const log = Array.from({ length: 120 }, (_, i) => session(1 + i, 1 + (i % 4)));
    const before = rareEvents(log.slice(0, 60), 'a');
    expect(rareEvents(log, 'a').slice(0, before.length)).toEqual(before);
  });

  it('is rare for a session early in the day, and more likely after a few hours of focus', () => {
    const chance = (sessions: (secret: string) => SessionRecord[]) => {
      let hits = 0;
      for (const secret of secrets(3000)) {
        const log = sessions(secret);
        if (rareEvents(log, secret).some((event) => event.id === log[log.length - 1]!.id)) hits++;
      }
      return hits / 3000;
    };
    const early = chance(() => [session(5, 50 / 60)]);
    expect(early).toBeGreaterThan(0.015);
    expect(early).toBeLessThan(0.04);
    // Four hours first, then the same session.
    const busy = chance(() => [...[8, 9, 10, 11].map((hour) => session(5, 1, hour)), session(5, 50 / 60, 13)]);
    expect(busy).toBeGreaterThan(0.06);
    expect(busy).toBeLessThan(0.11);
  });

  it('always brings a big one for the longest session yet, after the first few', () => {
    // Every other day, so no streak sets a record.
    const usual = Array.from({ length: 10 }, (_, i) => session(1 + i * 2, 0.5));
    for (const secret of secrets(20)) {
      const longer = session(25, 1.5);
      const event = rareEvents([...usual, longer], secret).find((e) => e.id === longer.id);
      expect(event?.reason).toBe('longestSession');
      expect(['meteorShower', 'aurora', 'supernova']).toContain(event?.kind);
    }
    // Not before there have been a few.
    const early = session(25, 1.5);
    expect(rareEvents([...usual.slice(0, 5), early], 'a').find((e) => e.reason === 'longestSession')).toBeUndefined();
  });

  it('brings one on the day a streak of days passes the longest yet', () => {
    const first = [session(1), session(2), session(3), session(4)];
    const later = [session(10), session(11), session(12), session(13), session(14)];
    for (const secret of secrets(20)) {
      const best = rareEvents([...first, ...later], secret).filter((e) => e.reason === 'longestStreak');
      // Day 3 of the first streak, then day 5 of the next, which passes 4.
      expect(best.map((e) => [e.id, e.streakDays])).toEqual([
        [first[2]!.id, 3],
        [later[4]!.id, 5],
      ]);
    }
  });

  it('now and then happens to the month’s round planet instead, once a month', () => {
    // Every other day, so no streak sets a record, and all the same length.
    const october = Array.from({ length: 15 }, (_, i) => session(1 + i * 2, 1.5));
    const [planet] = planets(stars(october));
    const hits: RareEvent[] = [];
    for (const secret of secrets(1500)) {
      const onPlanet = rareEvents(october, secret).filter((e) => e.planetId);
      expect(onPlanet.length).toBeLessThanOrEqual(1);
      hits.push(...onPlanet);
    }
    expect(hits.length).toBeGreaterThan(10);
    for (const hit of hits) {
      expect(hit.planetId).toBe(planet!.id);
      expect(['moonCrash', 'split', 'shatter']).toContain(hit.kind);
      // Not before the month has 10 hours: the seventh session gets there.
      expect(october.findIndex((s) => s.id === hit.id)).toBeGreaterThanOrEqual(6);
    }
    expect(new Set(hits.map((hit) => hit.kind))).toEqual(new Set(['moonCrash', 'split', 'shatter']));

    const event = hits[0]!;
    const hit = planets(stars(october), [event])[0]!;
    expect(hit.event).toMatchObject({ id: event.id, kind: event.kind, at: event.at });
    expect(planets(stars(october), [{ ...event, kind: 'aurora' }])[0]!.event).toBeUndefined();
  });

  it('gives broken sessions nothing', () => {
    const log = Array.from({ length: 300 }, (_, i) => session(1 + i * 2, 3, 9, { broken: true }));
    expect(rareEvents(log, 'a')).toEqual([]);
  });
});

describe('best month', () => {
  it('gives the month with the most focus a halo, once there are two', () => {
    const october = [session(1, 3), session(9, 2)];
    expect(planets(stars(october))[0]!.best).toBe(false);
    const november = [session(33, 2)];
    expect(planets(stars([...october, ...november])).map((p) => p.best)).toEqual([true, false]);
    const busier = [...november, session(40, 4)];
    expect(planets(stars([...october, ...busier])).map((p) => p.best)).toEqual([false, true]);
  });
});
