import { seeded, type Star } from './sky';

// Planets and moons (PLAN §5): one planet for every month with any focus, and moons around it
// from focus streaks. Like the stars, they're worked out from the session log every time, so the
// same log always gives the same sky, and a month's planet stays as it was once the month is over.

const hourMs = 60 * 60_000;
/** Focus in a month at which its planet reaches full size. */
const largestPlanetHours = 60;
/**
 * Hours of focus in a month at which its planet gains each detail. Each one starts faint and
 * fills in as the hours go on, so a planet keeps changing all month, not just growing.
 */
const detailHours = {
  /** The first band. One more every few hours after it, up to `mostBands`. */
  bands: 2,
  /** A soft glowing atmosphere, fullest at `glowFullHours`. */
  glow: 8,
  /** A ring, at its widest at `ringFullHours`. */
  ring: 20,
  /** A storm swirling in its bands. */
  storm: 35,
  /** A second, fainter ring outside the first. */
  outerRing: 50,
};
const hoursPerBand = 5;
const mostBands = 6;
const glowFullHours = 30;
const ringFullHours = 45;
/** Days of focus in a row at which a streak earns a moon: these, then every week after. */
const moonDays = [3, 7, 14];
const lastMoonDays = moonDays[moonDays.length - 1]!;
const moonDaysAfter = 7;
/** The most moons a planet can have. */
const mostMoons = 3;

/** A color as hue (degrees), saturation and lightness (percent). */
export type Hsl = [number, number, number];

/** A moon, earned by focusing a few days in a row. Missed days never take one away. */
export interface Moon {
  /** Made from the streak's first star and how long the streak was, so it never changes. */
  id: string;
  /** Midnight at the start of the day it was earned, local time (epoch ms). */
  earnedOn: number;
  /** How many days in a row the streak had reached when it earned this moon. */
  streakDays: number;
  /** How far out it orbits, in its planet's radii. */
  orbit: number;
  /** Its size, in its planet's radii. */
  size: number;
  /** Where it starts on its orbit, in radians. */
  angle: number;
  color: Hsl;
}

/** One month's planet. */
export interface Planet {
  /** The month's first star's id, which doesn't change as the month goes on. */
  id: string;
  /** Midnight at the start of the month's first day, local time (epoch ms). */
  monthStart: number;
  /** Focus in the month, overtime included (ms). */
  focusMs: number;
  /** How big it is, from 0 to 1. It follows the month's focus, fast at first and then slowly. */
  size: number;
  colors: { body: Hsl; band: Hsl; ring: Hsl };
  /** How far its bands and rings lean, in radians. */
  tilt: number;
  /** How many bands it has, and where each sits across it (-1 to 1) and how thick it is (0 to 1). */
  bands: { at: number; width: number }[];
  /** How strong its atmosphere's glow is, from 0 (none) to 1. */
  glow: number;
  /** How wide its ring is, from 0 (none yet) to 1. */
  ring: number;
  /** How flat its ring looks, from 0 (edge on) to 1 (face on). */
  ringTilt: number;
  /** How visible its outer ring is, from 0 (none yet) to 1. */
  outerRing: number;
  /** Its storm, once it has one: where it sits (-1 to 1 across and down) and how strong it is (0 to 1). */
  storm?: { x: number; y: number; strength: number };
  /** Oldest first, at most three. */
  moons: Moon[];
}

/**
 * The planets a sky's stars make, oldest first: one for every month with stars, in local time.
 * A month without focus has no planet.
 */
export function planets(sky: readonly Star[]): Planet[] {
  const sorted = [...sky].sort((a, b) => a.startedAt - b.startedAt);
  const months = new Map<number, Star[]>();
  for (const star of sorted) {
    const start = monthStart(star.startedAt);
    const month = months.get(start);
    if (month) month.push(star);
    else months.set(start, [star]);
  }
  const moons = streakMoons(sorted);
  return [...months].map(([start, stars]) => {
    const focusMs = stars.reduce((total, star) => total + star.focusedMs + star.overtimeMs, 0);
    return planet(stars[0]!.id, start, focusMs, moons.get(start) ?? []);
  });
}

/** A planet's look: its colors and lean come from its id, and its details from its focus. */
function planet(id: string, start: number, focusMs: number, moons: Moon[]): Planet {
  const random = seeded(id);
  const hours = focusMs / hourMs;
  const hue = random() * 360;
  const body: Hsl = [hue, 30 + random() * 25, 56 + random() * 12];
  const bandShift = (random() < 0.5 ? -1 : 1) * (12 + random() * 28);
  const band: Hsl = [(hue + bandShift + 360) % 360, body[1] + 8, body[2] - 14 + random() * 6];
  const ring: Hsl = [(hue + 20 + random() * 40) % 360, 18 + random() * 20, 76 + random() * 10];
  const tilt = (random() - 0.5) * 0.9;
  const ringTilt = 0.18 + random() * 0.2;
  // Every band's place comes from the seed, so a band stays put as more appear.
  const bandPlaces = Array.from({ length: mostBands }, () => ({
    at: random() * 1.6 - 0.8,
    width: 0.25 + random() * 0.75,
  }));
  const stormPlace = { x: random() * 0.9 - 0.45, y: random() * 1.0 - 0.5 };
  const bandCount = hours < detailHours.bands ? 0 : 1 + Math.floor((hours - detailHours.bands) / hoursPerBand);
  return {
    id,
    monthStart: start,
    focusMs,
    size: Math.min(1, Math.sqrt(hours / largestPlanetHours)),
    colors: { body, band, ring },
    tilt,
    bands: bandPlaces.slice(0, Math.min(mostBands, bandCount)),
    glow: fill(hours, detailHours.glow, glowFullHours),
    ring: fill(hours, detailHours.ring, ringFullHours),
    ringTilt,
    outerRing: fill(hours, detailHours.outerRing, detailHours.outerRing + 15),
    storm:
      hours >= detailHours.storm
        ? { ...stormPlace, strength: fill(hours, detailHours.storm, detailHours.storm + 15) }
        : undefined,
    moons: moons.slice(0, mostMoons),
  };
}

/** How far `hours` has got from `from` to `full`: 0 before it starts, a little just after, 1 at full. */
function fill(hours: number, from: number, full: number): number {
  if (hours < from) return 0;
  return Math.min(1, 0.25 + (0.75 * (hours - from)) / (full - from));
}

/**
 * The moons streaks have earned, by the start of the month they belong to: one on the day a
 * streak of days with focus reaches 3, 7 and 14 days in a row, then every week after, each going
 * to that day's month's planet. A missed day starts a new streak but takes nothing away.
 */
function streakMoons(sorted: readonly Star[]): Map<number, Moon[]> {
  const moons = new Map<number, Moon[]>();
  let streakId = '';
  let streakDays = 0;
  let lastDay = 0;
  for (const star of sorted) {
    const day = dayStart(star.startedAt);
    if (day === lastDay) continue;
    if (lastDay && day === nextDay(lastDay)) streakDays++;
    else {
      streakId = star.id;
      streakDays = 1;
    }
    lastDay = day;
    const earns = moonDays.includes(streakDays) || (streakDays > lastMoonDays && streakDays % moonDaysAfter === 0);
    if (!earns) continue;
    const id = `${streakId}:${streakDays}`;
    const random = seeded(id);
    const month = monthStart(day);
    const list = moons.get(month) ?? [];
    list.push({
      id,
      earnedOn: day,
      streakDays,
      // Each moon a little further out than the last, so their orbits don't cross.
      orbit: 1.9 + list.length * 0.55 + random() * 0.25,
      size: 0.13 + random() * 0.08,
      angle: random() * Math.PI * 2,
      color: [random() * 360, 6 + random() * 12, 70 + random() * 14],
    });
    moons.set(month, list);
  }
  return moons;
}

function monthStart(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function dayStart(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The start of the day after the one starting at `day`, even across a daylight saving change. */
function nextDay(day: number): number {
  const date = new Date(day);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}
