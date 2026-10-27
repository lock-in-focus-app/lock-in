import { seeded, type Star } from './sky';

// Planets and moons (PLAN §5): one planet for every month with any focus, and moons around it
// from focus streaks. Like the stars, they're worked out from the session log every time, so the
// same log always gives the same sky, and a month's planet stays as it was once the month is over.
//
// The month's seed picks what kind of world it is and how it looks. The month's focus decides how
// far it has formed: from a core in a disk of dust, to a lumpy rock, to a round world with its
// kind's surface, then rings, an atmosphere, a crossing ring and an aurora.

const hourMs = 60 * 60_000;
/** Focus in a month at which its planet reaches full size. */
const largestPlanetHours = 60;
/**
 * Hours of focus in a month at which its planet reaches each stage. Each detail starts faint and
 * fills in as the hours go on, so a planet keeps changing all month, not just growing.
 */
const stageHours = {
  /** Before this, it's a small core in a swirling disk of dust. */
  lumpy: 3,
  /** Round, with its kind's surface: bands, craters, clouds or glowing cracks. */
  round: 10,
  /** Its first ring, in a style of its own. */
  ring: 20,
  /** An atmosphere, with polar caps (or a storm, on a gas giant). */
  atmosphere: 30,
  /** A second ring crossing the first (or more layers, on stacked rings). */
  secondRing: 45,
  /** Flattened a little at the poles from spinning, with an aurora. */
  aurora: 60,
};
/** How many hours each detail takes to fill in once it appears. */
const fillHours = 15;
/** Hours of focus per extra band or surface feature, once round. */
const hoursPerFeature = 5;
const mostFeatures = 8;
/** Days of focus in a row at which a streak earns a moon: these, then every week after. */
const moonDays = [3, 7, 14];
const lastMoonDays = moonDays[moonDays.length - 1]!;
const moonDaysAfter = 7;
/** The most moons a planet can have. */
const mostMoons = 3;

/** A color as hue (degrees), saturation and lightness (percent). */
export type Hsl = [number, number, number];

/**
 * What kind of world a planet is: banded gas, pale ice with swirls, cratered rock, an ocean
 * with clouds, or a dark world with glowing cracks.
 */
export type PlanetKind = 'gas' | 'ice' | 'rocky' | 'ocean' | 'ember';
export const planetKinds: readonly PlanetKind[] = ['gas', 'ice', 'rocky', 'ocean', 'ember'];
/** How far a planet has formed: a core in a dust disk, a lumpy rock, or a round world. */
export type PlanetForm = 'dust' | 'lumpy' | 'round';
/** One clean ring, several thin ones, a wide faint haze, or a broken ring of tiny moonlets. */
export type RingStyle = 'single' | 'stacked' | 'halo' | 'clumpy';
const ringStyles: readonly RingStyle[] = ['single', 'stacked', 'halo', 'clumpy'];

/** A ring around a planet. */
export interface PlanetRing {
  style: RingStyle;
  /** How filled in it is, from 0 to 1: wider and brighter as it fills. */
  amount: number;
  /** How far it leans, in radians, and how flat it looks, from 0 (edge on) to 1 (face on). */
  tilt: number;
  flat: number;
  /** How many thin rings make it up, for stacked rings. */
  layers: number;
}

/**
 * Something on a planet's surface (a crater, cloud, swirl or crack), placed by longitude (radians)
 * and latitude (-1 at the top pole to 1 at the bottom), so it turns with the planet as it spins.
 */
export interface SurfaceFeature {
  lon: number;
  lat: number;
  /** Its size, in the planet's radii. */
  size: number;
}

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
  /** Whether it has a crater or two showing. */
  craters: boolean;
}

/** One month's planet. */
export interface Planet {
  /** The month's first star's id, which doesn't change as the month goes on. */
  id: string;
  /** Midnight at the start of the month's first day, local time (epoch ms). */
  monthStart: number;
  /** Focus in the month, overtime included (ms). */
  focusMs: number;
  /** The profile with the most focus in the month, whose star color tints the planet's glow. */
  topProfileId: string;
  /** How big it is, from 0 to 1. It follows the month's focus, fast at first and then slowly. */
  size: number;
  kind: PlanetKind;
  form: PlanetForm;
  /** How visible its disk of dust is, from 0 (gone) to 1. */
  dust: number;
  /** How uneven its outline is, from 0 (round) to 1, and the bumps, from -1 to 1, evenly round it. */
  lumpiness: number;
  outline: number[];
  colors: { body: Hsl; detail: Hsl; ring: Hsl; aurora: Hsl };
  /** How far it leans, in radians. */
  tilt: number;
  /** How fast and which way it spins while exploring: laps of its own for each lap of the sky. */
  spin: number;
  /** Its bands, by where each sits from pole to pole (-1 to 1) and how thick it is (0 to 1). */
  bands: { at: number; width: number }[];
  /** Craters, clouds, swirls or cracks, by its kind. */
  features: SurfaceFeature[];
  /** How strong its atmosphere's glow is, from 0 (none) to 1. */
  glow: number;
  /** How big its polar caps are, from 0 (none) to 1. */
  caps: number;
  /** A gas giant's storm, once it has one, and how strong it is (0 to 1). */
  storm?: SurfaceFeature & { strength: number };
  /** Its rings, the first then the one crossing it. */
  rings: PlanetRing[];
  /** How flattened it is at the poles from spinning, and how bright its aurora is, from 0 to 1. */
  flattening: number;
  aurora: number;
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
  const list: Planet[] = [];
  for (const [start, stars] of months) {
    list.push(planet(stars, start, moons.get(start) ?? [], list[list.length - 1]?.kind));
  }
  return list;
}

/**
 * A month's planet. Its look comes from its id, and never from the hours, so it only gains
 * detail as the month goes on. Its kind is never the same as the month before's.
 */
function planet(stars: readonly Star[], start: number, moons: Moon[], before?: PlanetKind): Planet {
  const id = stars[0]!.id;
  const focusMs = stars.reduce((total, star) => total + star.focusedMs + star.overtimeMs, 0);
  const hours = focusMs / hourMs;
  // Every seeded value is drawn whatever the hours, in the same order, so none of them change as
  // the month goes on.
  const random = seeded(id);
  let kind = pick(planetKinds, random());
  const instead = random();
  if (kind === before) {
    kind = planetKinds[(planetKinds.indexOf(kind) + 1 + Math.floor(instead * 4)) % planetKinds.length]!;
  }
  const colors = palette(kind, random);
  const tilt = (random() - 0.5) * 0.8;
  const spin = (random() < 0.85 ? 1 : -1) * (3 + random() * 3);
  const outline = Array.from({ length: 9 }, () => random() * 2 - 1);
  const bandPlaces = Array.from({ length: 6 }, () => ({ at: random() * 1.6 - 0.8, width: 0.25 + random() * 0.75 }));
  const featurePlaces = Array.from({ length: mostFeatures }, () => ({
    lon: random() * Math.PI * 2,
    lat: (random() * 2 - 1) * 0.75,
    size: 0.12 + random() * 0.16,
  }));
  const stormPlace = { lon: random() * Math.PI * 2, lat: random() * 0.8 - 0.4, size: 0.2 };
  const ringStyle = pick(ringStyles, random());
  const ringTilt = tilt + (random() - 0.5) * 0.3;
  const ringFlat = 0.18 + random() * 0.2;
  const crossing = (random() < 0.5 ? -1 : 1) * (0.5 + random() * 0.4);
  const crossingFlat = 0.2 + random() * 0.25;

  const round = hours >= stageHours.round;
  const features = round ? Math.min(mostFeatures, 2 + Math.floor((hours - stageHours.round) / hoursPerFeature)) : 0;
  const ringAmount = fill(hours, stageHours.ring);
  const secondRing = fill(hours, stageHours.secondRing);
  const rings: PlanetRing[] = [];
  if (ringAmount > 0) {
    rings.push({
      style: ringStyle,
      amount: ringAmount,
      tilt: ringTilt,
      flat: ringFlat,
      layers: ringStyle === 'stacked' ? (secondRing > 0 ? 5 : 3) : 1,
    });
    if (secondRing > 0 && ringStyle !== 'stacked') {
      rings.push({ style: 'single', amount: secondRing, tilt: ringTilt + crossing, flat: crossingFlat, layers: 1 });
    }
  }
  const atmosphere = fill(hours, stageHours.atmosphere);
  return {
    id,
    monthStart: start,
    focusMs,
    topProfileId: topProfile(stars),
    size: Math.min(1, Math.sqrt(hours / largestPlanetHours)),
    kind,
    form: hours < stageHours.lumpy ? 'dust' : round ? 'round' : 'lumpy',
    dust: Math.max(0, Math.min(1, 1 - (hours - stageHours.lumpy) / 2)),
    lumpiness: round ? 0 : 1 - (0.6 * Math.max(0, hours - stageHours.lumpy)) / (stageHours.round - stageHours.lumpy),
    outline,
    colors,
    tilt,
    spin,
    bands:
      kind === 'gas' ? bandPlaces.slice(0, features) : kind === 'ice' ? bandPlaces.slice(0, Math.min(3, features)) : [],
    features: kind === 'gas' ? [] : featurePlaces.slice(0, features),
    glow: atmosphere,
    caps: kind === 'gas' || kind === 'ember' ? 0 : atmosphere,
    storm: kind === 'gas' && atmosphere > 0 ? { ...stormPlace, strength: atmosphere } : undefined,
    rings,
    flattening: fill(hours, stageHours.aurora),
    aurora: fill(hours, stageHours.aurora),
    moons: moons.slice(0, mostMoons),
  };
}

/** A kind's colors, varied by the seed. */
function palette(kind: PlanetKind, random: () => number): Planet['colors'] {
  const ring: Hsl = [random() * 360, 15 + random() * 20, 76 + random() * 10];
  const aurora: Hsl = random() < 0.6 ? [140 + random() * 40, 70, 62] : [290 + random() * 40, 65, 68];
  const hue = random() * 360;
  const shift = (random() < 0.5 ? -1 : 1) * (12 + random() * 28);
  const a = random();
  const b = random();
  switch (kind) {
    case 'gas':
      return {
        body: [hue, 26 + a * 20, 56 + b * 12],
        detail: [(hue + shift + 360) % 360, 34 + a * 20, 44 + b * 10],
        ring,
        aurora,
      };
    case 'ice':
      return { body: [170 + a * 60, 25 + b * 20, 70 + a * 8], detail: [190 + b * 40, 30, 84], ring, aurora };
    case 'rocky':
      return { body: [hue, 8 + a * 18, 48 + b * 12], detail: [hue, 10 + a * 12, 30 + b * 8], ring, aurora };
    case 'ocean':
      return { body: [175 + a * 45, 45 + b * 20, 40 + a * 10], detail: [200, 20, 94], ring, aurora };
    case 'ember':
      return { body: [a * 30, 20 + b * 15, 18 + a * 8], detail: [15 + b * 25, 95, 58], ring, aurora };
  }
}

function pick<T>(list: readonly T[], value: number): T {
  return list[Math.floor(value * list.length)]!;
}

/** How far `hours` has got through a detail starting at `from`: 0 before it, a little just after, 1 once filled in. */
function fill(hours: number, from: number): number {
  if (hours < from) return 0;
  return Math.min(1, 0.25 + (0.75 * (hours - from)) / fillHours);
}

/** The profile with the most focus among `stars`, the first to get there on a tie. */
function topProfile(stars: readonly Star[]): string {
  const totals = new Map<string, number>();
  let top = stars[0]!.profileId;
  for (const star of stars) {
    const total = (totals.get(star.profileId) ?? 0) + star.focusedMs + star.overtimeMs;
    totals.set(star.profileId, total);
    if (total > totals.get(top)!) top = star.profileId;
  }
  return top;
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
    const icy = random() < 0.3;
    list.push({
      id,
      earnedOn: day,
      streakDays,
      // Each moon a little further out than the last, so their orbits don't cross.
      orbit: 1.9 + list.length * 0.55 + random() * 0.25,
      size: 0.1 + random() * 0.14,
      angle: random() * Math.PI * 2,
      color: icy ? [195 + random() * 25, 35, 82] : [random() * 360, 6 + random() * 12, 66 + random() * 16],
      craters: random() < 0.6,
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
