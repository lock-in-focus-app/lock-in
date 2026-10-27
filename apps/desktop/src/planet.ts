import type { Hsl, Planet, PlanetRing, SurfaceFeature } from '@lock-in/core';

// Draws one planet on the night sky's canvas (PLAN §5). The planet's kind, form, shape, rings and
// other details come from the reward engine (packages/core/src/planets.ts); this turns them into
// soft shapes, lit from the top left. Surface features sit at a longitude, so they turn with the
// planet as it spins, and the far half of each ring, dust disk and moon orbit goes behind it.
//
// A planet that isn't moving is drawn once and kept as an image (`stampPlanet`), so the Sky page
// costs a few image copies a frame however detailed the planets get.

const goldenAngle = Math.PI * (3 - Math.sqrt(5));
/** How many specks of dust swirl around a planet that's still forming. */
const dustSpecks = 40;
/** How many moonlets make up a clumpy ring, and icicles hang from a frosted one. */
const moonlets = 56;
const icicles = 30;
/** How many points go round a planet's outline. */
const outlinePoints = 72;
/** How much faster moons go round than planets do, for a moon two planet radii out. */
const moonSpeed = 6;
/** How often an electric ring's lightning jumps to new places while exploring. */
const lightningMs = 140;
/** How far out from a planet's middle anything of it reaches (moons, rings, dust), in its radii. */
const planetReach = 3.8;

/** Where and how to draw a planet. */
export interface PlanetView {
  /** Its middle and radius, in canvas pixels. */
  x: number;
  y: number;
  radius: number;
  alpha: number;
  /** How much it shines from being hovered, from 0 to 1. */
  glow: number;
  /** The star color of the month's top profile, for rings in that color ("#rrggbb"). */
  tint: string;
  /** How far the sky has turned while exploring, in radians: planets spin and moons go round with it. */
  turn: number;
  /** For things that flicker or shimmer (ms), which they only do while `lively` (exploring, without reduced motion). */
  time: number;
  lively: boolean;
}

const hsl = ([h, s, l]: Hsl, alpha = 1, lighter = 0) =>
  `hsl(${h} ${s}% ${Math.min(100, Math.max(0, l + lighter))}% / ${alpha})`;

/** A "#rrggbb" color with an alpha from 0 to 1. */
const withAlpha = (hex: string, alpha: number) =>
  `${hex}${Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** A number from 0 to 1 that's always the same for the same `n`, for small details like cracks. */
function noise(n: number): number {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const cache = new Map<string, { canvas: HTMLCanvasElement; key: string }>();

/**
 * Draws a planet, reusing an image of it from the last time when nothing about it has changed.
 * Anything moving (exploring, hovered, a different size mid-glide) is drawn fresh.
 */
export function stampPlanet(c: CanvasRenderingContext2D, planet: Planet, view: PlanetView) {
  if (view.lively || view.glow > 0.001) {
    drawPlanet(c, planet, view);
    return;
  }
  const radius = Math.round(view.radius * 2) / 2;
  const key = `${planet.kind}|${planet.focusMs}|${planet.moons.length}|${radius}|${view.turn.toFixed(4)}|${view.tint}`;
  let entry = cache.get(planet.id);
  const half = Math.ceil(radius * planetReach) + 4;
  if (!entry || entry.key !== key) {
    const canvas = entry?.canvas ?? document.createElement('canvas');
    // A new canvas starts 300 by 150, so both sides are checked; it has to be square.
    if (canvas.width < half * 2 || canvas.height !== canvas.width)
      canvas.width = canvas.height = Math.max(half * 2, canvas.width);
    const offscreen = canvas.getContext('2d')!;
    offscreen.setTransform(1, 0, 0, 1, 0, 0);
    offscreen.clearRect(0, 0, canvas.width, canvas.height);
    const middle = canvas.width / 2;
    drawPlanet(offscreen, planet, { ...view, x: middle, y: middle, radius, alpha: 1 });
    entry = { canvas, key };
    cache.set(planet.id, entry);
  }
  const middle = entry.canvas.width / 2;
  c.globalAlpha = view.alpha;
  c.drawImage(entry.canvas, view.x - middle, view.y - middle);
}

/** Forgets the images of planets that are no longer in the sky. */
export function forgetPlanets(ids: ReadonlySet<string>) {
  for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
}

export function drawPlanet(c: CanvasRenderingContext2D, planet: Planet, view: PlanetView) {
  const { x, y, radius, glow, turn } = view;
  // A planet still forming is a smaller core inside its dust.
  const core = planet.form === 'dust' ? radius * 0.6 : radius;
  c.globalAlpha = view.alpha;

  drawGlow(c, planet, x, y, core, glow);

  const moons = planet.moons.map((moon) => {
    const angle = moon.angle + (turn * moonSpeed * 2) / moon.orbit;
    const across = Math.cos(angle) * moon.orbit * radius;
    const down = Math.sin(angle) * moon.orbit * radius * 0.32;
    return { moon, ...leaned(x, y, across, down, planet.tilt), behind: Math.sin(angle) < 0 };
  });

  // The far halves first, then the planet, then the near halves over it.
  drawMoons(c, moons, radius, true);
  if (planet.dust > 0) drawDust(c, planet, x, y, radius, turn, true);
  for (const ring of planet.rings) drawRing(c, planet, ring, x, y, radius, view, true);

  if (planet.shape === 'linked' && planet.shapeAmount > 0) drawLinked(c, planet, x, y, core, turn);
  else drawBody(c, planet, x, y, core, turn);
  if (planet.shell > 0 && planet.shape !== 'linked') drawShell(c, planet, x, y, core);
  if (planet.aurora > 0 && planet.shape !== 'linked' && planet.shape !== 'donut') {
    drawAurora(c, planet, x, y, core, view);
  }

  for (const ring of planet.rings) drawRing(c, planet, ring, x, y, radius, view, false);
  if (planet.dust > 0) drawDust(c, planet, x, y, radius, turn, false);
  drawMoons(c, moons, radius, false);
}

/**
 * A soft glow around the planet in its own color, following its shape, stronger with an
 * atmosphere and while hovered. Lava and marble worlds glow in their bright color.
 */
function drawGlow(c: CanvasRenderingContext2D, planet: Planet, x: number, y: number, radius: number, hovered: number) {
  const bright = planet.kind === 'lava' || planet.kind === 'marble';
  const color = bright ? planet.colors.detail : planet.colors.body;
  const strength = Math.min(1, (bright ? 0.45 : 0.3) + 0.4 * planet.glow + 0.3 * hovered);
  if (planet.shape === 'linked' && planet.shapeAmount > 0) {
    glowAround(c, x, y, radius * 0.6, radius * 1.4, hsl(color, 0.3 * strength, 12), hsl(color, 0, 12));
    return;
  }
  // The planet's outline casts a blurred shadow in its color. The outline itself is covered
  // by the planet, drawn over it, so only the glow shows.
  c.save();
  c.translate(x, y);
  c.rotate(planet.tilt);
  c.shadowColor = hsl(color, strength, 12);
  c.shadowBlur = radius * (0.35 + 0.35 * planet.glow);
  c.fillStyle = hsl(planet.colors.body);
  tracePlanet(c, planet, radius * 0.98);
  c.fill('evenodd');
  c.restore();
}

function glowAround(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  from: number,
  to: number,
  inner: string,
  outer: string,
) {
  const light = c.createRadialGradient(x, y, from, x, y, to);
  light.addColorStop(0, inner);
  light.addColorStop(1, outer);
  c.fillStyle = light;
  c.beginPath();
  c.arc(x, y, to, 0, Math.PI * 2);
  c.fill();
}

/** Where a point `across` and `down` from a planet's middle ends up, leaning with the planet. */
function leaned(x: number, y: number, across: number, down: number, tilt: number) {
  return {
    x: x + across * Math.cos(tilt) - down * Math.sin(tilt),
    y: y + across * Math.sin(tilt) + down * Math.cos(tilt),
  };
}

/** How squashed top to bottom a planet's shape is, as a share of its width. */
function squash(planet: Planet): number {
  const t = planet.shapeAmount;
  const shape = { flat: lerp(1, 0.3, t), donut: lerp(1, 0.55, t), pumpkin: 1 - 0.24 * t, gem: 1 + 0.25 * t };
  const by = planet.shape in shape ? shape[planet.shape as keyof typeof shape] : 1;
  return by * (1 - 0.1 * planet.flattening);
}

/**
 * How far out a planet's outline reaches at `angle` (in its own leaning frame), in its radii:
 * its lumps while forming, then its shape coming through as `shapeAmount` grows.
 */
function reachAt(planet: Planet, angle: number): number {
  const count = planet.outline.length;
  const at = ((angle / (Math.PI * 2)) * count + count) % count;
  const i = Math.floor(at);
  const blend = (1 - Math.cos((at - i) * Math.PI)) / 2;
  const bump = lerp(planet.outline[i]!, planet.outline[(i + 1) % count]!, blend);
  let reach = 1 + 0.28 * planet.lumpiness * bump;
  const t = planet.shapeAmount;
  const [a, b] = planet.shapeSeed;
  switch (planet.shape) {
    case 'star': {
      const points = 5 + Math.floor(a * 3);
      const wave = Math.cos(points * (angle + Math.PI / 2));
      reach *= 1 + t * (0.42 * Math.sign(wave) * Math.abs(wave) ** 0.7 - 0.08);
      break;
    }
    case 'peanut':
      // Pinched in the middle, one half a little bigger than the other.
      reach *= 1 + t * (0.5 * Math.cos(2 * angle) + 0.16 * (b - 0.5) * Math.cos(angle));
      break;
    case 'gem': {
      const facets = 5 + Math.floor(a * 2);
      const side = (Math.PI * 2) / facets;
      const along = ((((angle + Math.PI / 2) % side) + side) % side) - side / 2;
      reach *= lerp(1, Math.cos(side / 2) / Math.cos(along), t);
      break;
    }
    case 'pumpkin': {
      const lobes = 7 + Math.floor(a * 3);
      // Lobes round the outline, and a dip at the top where the stem is.
      const top = angle + Math.PI / 2;
      const dip = Math.exp(-(Math.atan2(Math.sin(top), Math.cos(top)) ** 2) / 0.06);
      reach *= 1 + t * (0.06 * Math.cos(lobes * angle) - 0.18 * dip);
      break;
    }
  }
  return reach;
}

/**
 * Traces a planet's outline around its middle, in its own leaning frame, `down` lower than it
 * (for the edge of a flat disc). A ring world gets its hole, so fill or clip it with "evenodd".
 */
function tracePlanet(c: CanvasRenderingContext2D, planet: Planet, radius: number, down = 0) {
  const tall = squash(planet);
  const wide = planet.shape === 'donut' ? 1 + 0.12 * planet.shapeAmount : 1;
  c.beginPath();
  for (let i = 0; i <= outlinePoints; i++) {
    const angle = (i / outlinePoints) * Math.PI * 2;
    const reach = radius * reachAt(planet, angle);
    const px = Math.cos(angle) * reach * wide;
    const py = Math.sin(angle) * reach * tall + down;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
  if (planet.shape === 'donut' && planet.shapeAmount > 0) {
    const hole = donutHole(planet, radius);
    c.moveTo(hole.across, hole.down + down);
    c.ellipse(0, hole.down + down, hole.across, hole.across * 0.45, 0, 0, Math.PI * 2);
  }
}

function donutHole(planet: Planet, radius: number) {
  return { across: radius * 0.42 * planet.shapeAmount * (0.8 + 0.4 * planet.shapeSeed[1]), down: -radius * 0.04 };
}

/** The light's direction (top left of the screen) in a planet's own leaning frame, `distance` out. */
function light(planet: Planet, distance: number) {
  const angle = (-3 * Math.PI) / 4 - planet.tilt;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

function drawBody(c: CanvasRenderingContext2D, planet: Planet, x: number, y: number, radius: number, turn: number) {
  const { body, detail } = planet.colors;
  const t = planet.shapeAmount;
  c.save();
  c.translate(x, y);
  c.rotate(planet.tilt);

  if (planet.shape === 'flat' && t > 0) {
    // A flat disc's edge, like a coin's, under its face.
    const thick = radius * 0.14 * t * (0.6 + 0.8 * planet.shapeSeed[1]);
    c.fillStyle = hsl(body, 1, -22);
    for (let step = 6; step > 0; step--) {
      tracePlanet(c, planet, radius, (thick * step) / 6);
      c.fill();
    }
  }

  tracePlanet(c, planet, radius);
  c.save();
  c.clip('evenodd');
  const lit = light(planet, radius * 0.5);
  const lava = planet.kind === 'lava' && planet.form === 'round';
  // A lava world is its glowing lava underneath, with its crust floating on top.
  const base = lava ? detail : body;
  const surface = c.createRadialGradient(lit.x, lit.y, 0, 0, 0, radius * 1.3);
  surface.addColorStop(0, hsl(base, 1, lava ? 20 : 12));
  surface.addColorStop(0.6, hsl(base));
  surface.addColorStop(1, hsl(base, 1, -16));
  c.fillStyle = surface;
  c.fillRect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 3.2);

  // A flat disc's or ring world's surface lies on its face.
  c.save();
  if (planet.shape === 'flat' || planet.shape === 'donut') c.scale(1, squash(planet));
  const spin = turn * planet.spin;
  drawBands(c, planet, radius, spin);
  for (const feature of planet.features) drawFeature(c, planet, feature, radius, spin);
  if (planet.storm) drawStorm(c, planet, radius, spin);
  if (planet.caps > 0) {
    c.fillStyle = planet.kind === 'ice' ? hsl(body, 0.9, 18) : hsl([body[0], 15, 94], 0.85);
    for (const pole of [-1, 1]) {
      c.beginPath();
      c.ellipse(0, pole * radius * 0.97, radius * 0.5 * planet.caps, radius * 0.2 * planet.caps, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (planet.shape === 'pumpkin' && t > 0) drawRibs(c, planet, radius, spin);
  if (planet.shape === 'gem' && t > 0) drawFacets(c, planet, radius);
  c.restore();

  // Its night side, away from the light. Lava glows through it.
  const from = light(planet, radius * 0.64);
  const to = light(planet, radius * 0.28);
  const night = c.createRadialGradient(from.x, from.y, radius * 0.4, to.x, to.y, radius * 1.7);
  night.addColorStop(0, 'rgb(6 9 20 / 0)');
  night.addColorStop(1, `rgb(6 9 20 / ${lava ? 0.55 : 0.85})`);
  c.fillStyle = night;
  c.fillRect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 3.2);
  if (lava) {
    // Its edge glows bright.
    const rim = c.createRadialGradient(0, 0, radius * 0.72, 0, 0, radius * 1.02);
    rim.addColorStop(0, hsl(detail, 0));
    rim.addColorStop(1, hsl(detail, 0.6, 10));
    c.fillStyle = rim;
    c.fillRect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 3.2);
  }
  if (planet.shape === 'donut' && t > 0) {
    // The inside of the hole, in shadow.
    const hole = donutHole(planet, radius);
    c.strokeStyle = 'rgb(6 9 20 / 0.5)';
    c.lineWidth = radius * 0.12 * t;
    c.beginPath();
    c.ellipse(0, hole.down * squash(planet), hole.across, hole.across * 0.45, 0, Math.PI, Math.PI * 2);
    c.stroke();
  }
  c.restore();

  if (planet.shape === 'pumpkin' && t > 0) {
    // A little curled stem in the dip at the top.
    const top = -radius * reachAt(planet, -Math.PI / 2) * squash(planet);
    c.strokeStyle = hsl([95, 30, 34], t);
    c.lineWidth = radius * 0.16;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, top + radius * 0.08);
    c.quadraticCurveTo(radius * 0.02, top - radius * 0.24, radius * 0.2, top - radius * 0.28);
    c.stroke();
  }
  c.restore();
}

/** A gas giant's bands with wavy edges, drifting as it spins, or an ice giant's faint ones. */
function drawBands(c: CanvasRenderingContext2D, planet: Planet, radius: number, spin: number) {
  const { detail } = planet.colors;
  const wavy = planet.kind === 'gas';
  for (const band of planet.bands) {
    const middle = band.at * radius;
    const half = band.width * radius * 0.13;
    const height = wavy ? radius * 0.06 * band.wave : 0;
    const often = 3 + 4 * band.wave;
    const shift = band.at * 10 + spin;
    const edge = (side: number, across: number) =>
      middle + side * half + height * Math.sin((often * across) / radius + shift + side);
    // Twice: a wide, faint pass for a soft edge, and the band itself.
    for (const [spread, alpha] of [
      [1.6, wavy ? 0.16 : 0.12],
      [1, wavy ? 0.45 : 0.22],
    ] as const) {
      c.fillStyle = hsl(detail, alpha);
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const across = -radius + (i / 16) * radius * 2;
        const at = middle + (edge(-1, across) - middle) * spread;
        if (i) c.lineTo(across, at);
        else c.moveTo(across, at);
      }
      for (let i = 16; i >= 0; i--) {
        const across = -radius + (i / 16) * radius * 2;
        c.lineTo(across, middle + (edge(1, across) - middle) * spread);
      }
      c.closePath();
      c.fill();
    }
  }
}

/**
 * Where a surface feature is seen, as the planet turns: across and down from its middle, and how
 * much it faces you (1 head on, 0 at the edge). Undefined while it's round the back.
 */
function seen(lon: number, lat: number, radius: number, spin: number) {
  const angle = lon + spin;
  const facing = Math.cos(angle);
  if (facing < -0.15) return undefined;
  const across = Math.sin(angle) * Math.sqrt(1 - lat * lat) * radius;
  return { across, down: lat * radius, facing: Math.max(0.15, facing) };
}

/** A crater or bump, cloud, crack, eddy, swirl or crust plate, by the planet's kind. */
function drawFeature(
  c: CanvasRenderingContext2D,
  planet: Planet,
  feature: SurfaceFeature,
  radius: number,
  spin: number,
) {
  if (planet.kind === 'marble') {
    drawRibbon(c, planet, feature, radius, spin);
    return;
  }
  const at = seen(feature.lon, feature.lat, radius, spin);
  if (!at) return;
  const size = feature.size * radius;
  const { body, detail } = planet.colors;
  const n = feature.lon * 100 + feature.lat * 10;
  switch (planet.kind) {
    case 'rocky':
      if (planet.rockySurface === 'craters') {
        // A dark bowl with a lit rim.
        c.fillStyle = hsl(detail, 0.75);
        c.beginPath();
        c.ellipse(at.across, at.down, size * 0.6 * at.facing, size * 0.6, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = hsl(body, 0.6, 18);
        c.lineWidth = size * 0.14;
        c.beginPath();
        c.ellipse(at.across, at.down, size * 0.6 * at.facing, size * 0.6, 0, Math.PI * 0.6, Math.PI * 1.6);
        c.stroke();
      } else {
        // A dome standing up from the surface, lit from the top left.
        const dome = c.createRadialGradient(
          at.across - size * 0.2 * at.facing,
          at.down - size * 0.2,
          0,
          at.across,
          at.down,
          size * 0.65,
        );
        dome.addColorStop(0, hsl(body, 1, 30));
        dome.addColorStop(0.6, hsl(body, 1, 6));
        dome.addColorStop(1, hsl(detail, 0.95, -6));
        c.fillStyle = dome;
        c.beginPath();
        c.ellipse(at.across, at.down, size * 0.7 * at.facing, size * 0.7, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    case 'ocean': {
      // A soft white cloud, stretched by the winds.
      // Wispy: a long streak with a smaller puff trailing off it.
      for (const [shift, scale] of [
        [0, 1],
        [0.9, 0.55],
      ] as const) {
        const px = at.across + size * shift * 1.6 * at.facing;
        const py = at.down + size * shift * 0.35 * (noise(n) - 0.5);
        const cloud = c.createRadialGradient(px, py, 0, px, py, size * 1.6 * scale);
        cloud.addColorStop(0, hsl(detail, 0.75));
        cloud.addColorStop(1, hsl(detail, 0));
        c.fillStyle = cloud;
        c.beginPath();
        c.ellipse(px, py, size * 2.4 * scale * at.facing, size * 0.45 * scale, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'ice': {
      // A branching crack in the ice, glowing faintly.
      const heading = noise(n) * Math.PI * 2;
      const step = size * 0.75;
      const line: { x: number; y: number }[] = [{ x: at.across, y: at.down }];
      for (let i = 1; i < 6; i++) {
        const turn = heading + (noise(n + i) - 0.5) * 1.2;
        const last = line[i - 1]!;
        line.push({ x: last.x + Math.cos(turn) * step * at.facing, y: last.y + Math.sin(turn) * step });
      }
      const fork = line[2]!;
      const branch = [fork];
      for (let i = 1; i < 4; i++) {
        const turn = heading + 1 + (noise(n + 10 + i) - 0.5);
        const last = branch[i - 1]!;
        branch.push({ x: last.x + Math.cos(turn) * step * 0.8 * at.facing, y: last.y + Math.sin(turn) * step * 0.8 });
      }
      for (const [width, color] of [
        [0.12, hsl(body, 0.45, 22)],
        [0.05, hsl(detail, 0.85)],
      ] as const) {
        c.strokeStyle = color;
        c.lineWidth = radius * width;
        c.lineJoin = 'round';
        for (const path of [line, branch]) {
          c.beginPath();
          path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
          c.stroke();
        }
      }
      break;
    }
    case 'gas':
      // A little eddy curling at the edge of a band.
      c.strokeStyle = hsl(detail, 0.5, 14);
      c.lineWidth = size * 0.16;
      c.beginPath();
      c.ellipse(at.across, at.down, size * 0.5 * at.facing, size * 0.28, 0, 0, Math.PI * 1.5);
      c.stroke();
      break;
    case 'lava': {
      // A dark, rounded plate of crust, with lava glowing in the gaps around it.
      const corners = Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + noise(n) * 2;
        const reach = size * 2.2 * (0.8 + 0.3 * noise(n + i));
        return { x: at.across + Math.cos(angle) * reach * at.facing, y: at.down + Math.sin(angle) * reach };
      });
      c.fillStyle = hsl(body, 1, 4);
      smoothShape(c, corners);
      c.fill();
      break;
    }
  }
}

/** A smooth closed curve through `points`, rounding off their corners. */
function smoothShape(c: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]) {
  const middle = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const start = middle(points[points.length - 1]!, points[0]!);
  c.beginPath();
  c.moveTo(start.x, start.y);
  points.forEach((point, i) => {
    const next = middle(point, points[(i + 1) % points.length]!);
    c.quadraticCurveTo(point.x, point.y, next.x, next.y);
  });
  c.closePath();
}

/**
 * A marble world's ribbon of light: a long, meandering streak flowing round the planet, fading
 * at its ends, that turns with it.
 */
function drawRibbon(
  c: CanvasRenderingContext2D,
  planet: Planet,
  feature: SurfaceFeature,
  radius: number,
  spin: number,
) {
  const n = feature.lon * 100 + feature.lat * 10;
  const length = 1.4 + noise(n) * 1.2;
  const sway = 0.12 + 0.18 * noise(n + 1);
  const points: ({ x: number; y: number } | undefined)[] = [];
  for (let i = 0; i <= 24; i++) {
    const along = i / 24;
    const often = 3 + 5 * noise(n + 2);
    const lat = Math.max(-0.95, Math.min(0.95, feature.lat + sway * Math.sin(along * often + n)));
    const at = seen(feature.lon + along * length, lat, radius, spin);
    points.push(at && { x: at.across, y: at.down });
  }
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // In a few pieces, faint at the ends, so it fades in and out along its length.
  const pieces = [0.45, 1, 1, 0.45];
  const per = (points.length - 1) / pieces.length;
  for (const [width, alpha] of [
    [0.22, 0.2],
    [0.07, 0.75],
  ] as const) {
    c.lineWidth = radius * width * (0.6 + feature.size * 2);
    pieces.forEach((fade, piece) => {
      c.strokeStyle = hsl(planet.colors.detail, alpha * fade);
      c.beginPath();
      let drawing = false;
      for (let i = Math.round(piece * per); i <= Math.round((piece + 1) * per); i++) {
        const p = points[i];
        if (!p) {
          drawing = false;
          continue;
        }
        if (drawing) c.lineTo(p.x, p.y);
        else c.moveTo(p.x, p.y);
        drawing = true;
      }
      c.stroke();
    });
  }
}

/** A gas giant's storm: an oval eye in its bands. */
function drawStorm(c: CanvasRenderingContext2D, planet: Planet, radius: number, spin: number) {
  const storm = planet.storm!;
  const at = seen(storm.lon, storm.lat, radius, spin);
  if (!at) return;
  const { detail } = planet.colors;
  const eye = c.createRadialGradient(at.across, at.down, 0, at.across, at.down, radius * 0.2);
  eye.addColorStop(0, hsl(detail, 0.75 * storm.strength, 20));
  eye.addColorStop(0.6, hsl(detail, 0.45 * storm.strength, -6));
  eye.addColorStop(1, hsl(detail, 0));
  c.fillStyle = eye;
  c.beginPath();
  c.ellipse(at.across, at.down, radius * 0.2 * at.facing, radius * 0.11, 0, 0, Math.PI * 2);
  c.fill();
}

/** A pumpkin's ribs: curved grooves from pole to pole that turn as it spins. */
function drawRibs(c: CanvasRenderingContext2D, planet: Planet, radius: number, spin: number) {
  const lobes = 7 + Math.floor(planet.shapeSeed[0] * 3);
  c.strokeStyle = hsl(planet.colors.body, 0.65 * planet.shapeAmount, -24);
  c.lineWidth = radius * 0.055;
  for (let i = 0; i < lobes; i++) {
    const lon = (i / lobes) * Math.PI * 2 + spin;
    if (Math.cos(lon) < 0) continue;
    c.beginPath();
    for (let step = 0; step <= 12; step++) {
      const lat = -1 + step / 6;
      const px = Math.sin(lon) * Math.sqrt(Math.max(0, 1 - lat * lat)) * radius;
      if (step) c.lineTo(px, lat * radius);
      else c.moveTo(px, lat * radius);
    }
    c.stroke();
  }
}

/** A gem's facets: flat faces from its middle to each edge, lit or shaded by which way they face. */
function drawFacets(c: CanvasRenderingContext2D, planet: Planet, radius: number) {
  const facets = 5 + Math.floor(planet.shapeSeed[0] * 2);
  const lightAngle = (-3 * Math.PI) / 4 - planet.tilt;
  const corner = (i: number, scale: number) => {
    const angle = -Math.PI / 2 + (i - 0.5) * ((Math.PI * 2) / facets);
    const reach = radius * reachAt(planet, angle) * scale;
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
  };
  for (let i = 0; i < facets; i++) {
    const a = corner(i, 1.02);
    const b = corner(i + 1, 1.02);
    const facing = Math.cos(-Math.PI / 2 + i * ((Math.PI * 2) / facets) - lightAngle);
    c.fillStyle =
      facing > 0
        ? `rgb(255 255 255 / ${0.3 * facing * planet.shapeAmount})`
        : `rgb(6 9 20 / ${-0.38 * facing * planet.shapeAmount})`;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.closePath();
    c.fill();
  }
  // The flat top face, catching the light.
  c.fillStyle = `rgb(255 255 255 / ${0.2 * planet.shapeAmount})`;
  c.beginPath();
  for (let i = 0; i < facets; i++) {
    const p = corner(i, 0.45);
    if (i) c.lineTo(p.x, p.y);
    else c.moveTo(p.x, p.y);
  }
  c.closePath();
  c.fill();
}

/**
 * Two linked rings, each passing in front of the other once. While the shape is still coming
 * through, the round planet it was shrinks away inside them.
 */
function drawLinked(c: CanvasRenderingContext2D, planet: Planet, x: number, y: number, radius: number, turn: number) {
  const t = planet.shapeAmount;
  if (t < 1) {
    c.save();
    c.globalAlpha *= 1 - t;
    drawBody(c, { ...planet, shape: 'round', shapeAmount: 0 }, x, y, radius * (1 - 0.6 * t), turn);
    c.restore();
  }
  const { body, detail } = planet.colors;
  const reach = radius * 0.95;
  const tube = radius * 0.3 * t;
  const apart = reach * 0.45;
  const rings = [
    { ...leaned(x, y, -apart, 0, planet.tilt), tilt: planet.tilt, flat: 0.42 },
    { ...leaned(x, y, apart, 0, planet.tilt), tilt: planet.tilt + 1.2 + planet.shapeSeed[2] * 0.5, flat: 0.5 },
  ];
  c.lineCap = 'butt';
  const half = (ring: (typeof rings)[number], behind: boolean) => {
    const from = behind ? Math.PI : 0;
    const to = behind ? Math.PI * 2 : Math.PI;
    for (const [width, color, lift] of [
      [1, hsl(body, t), 0],
      [0.4, hsl(detail, 0.5 * t), 0],
      [0.25, hsl(body, 0.5 * t, 18), -0.22],
    ] as const) {
      c.strokeStyle = color;
      c.lineWidth = tube * width;
      c.beginPath();
      c.ellipse(ring.x, ring.y + tube * lift, reach, reach * ring.flat, ring.tilt, from, to);
      c.stroke();
    }
  };
  half(rings[0]!, true);
  half(rings[1]!, true);
  half(rings[0]!, false);
  half(rings[1]!, false);
}

/** A see-through glass shell around the planet, with a highlight where the light catches it. */
function drawShell(c: CanvasRenderingContext2D, planet: Planet, x: number, y: number, radius: number) {
  // It follows the planet's outline, a little out from it.
  const reach = radius * 1.16;
  c.save();
  c.translate(x, y);
  c.rotate(planet.tilt);
  const glass = c.createRadialGradient(0, 0, reach * 0.7, 0, 0, reach * 1.2);
  glass.addColorStop(0, 'rgb(255 255 255 / 0)');
  glass.addColorStop(1, `rgb(255 255 255 / ${0.12 * planet.shell})`);
  c.fillStyle = glass;
  tracePlanet(c, planet, reach);
  c.fill('evenodd');
  c.strokeStyle = hsl(
    planet.kind === 'lava' || planet.kind === 'marble' ? planet.colors.detail : planet.colors.body,
    0.35 * planet.shell,
    16,
  );
  c.lineWidth = radius * 0.025;
  c.stroke();
  // A highlight up to the top left, where the light catches it.
  c.strokeStyle = `rgb(255 255 255 / ${0.55 * planet.shell})`;
  c.lineWidth = radius * 0.06;
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i <= 10; i++) {
    const angle = -2.7 + (i / 10) * 0.75 - planet.tilt;
    const at = reach * 0.9 * reachAt(planet, angle);
    const px = Math.cos(angle) * at;
    const py = Math.sin(angle) * at * squash(planet);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.stroke();
  c.restore();
}

/** Curtains of light at the poles, shimmering slowly while exploring. */
function drawAurora(
  c: CanvasRenderingContext2D,
  planet: Planet,
  x: number,
  y: number,
  radius: number,
  view: PlanetView,
) {
  const shimmer = view.lively ? 0.75 + 0.25 * Math.sin(view.time / 1300 + planet.monthStart) : 1;
  const tall = squash(planet);
  c.save();
  c.translate(x, y);
  c.rotate(planet.tilt);
  for (const [pole, strength] of [
    [-1, 1],
    [1, 0.5],
  ] as const) {
    const middle = pole * radius * 0.92 * tall;
    const curtain = c.createRadialGradient(0, middle, 0, 0, middle, radius * 0.6);
    curtain.addColorStop(0, hsl(planet.colors.aurora, 0.55 * planet.aurora * strength * shimmer));
    curtain.addColorStop(1, hsl(planet.colors.aurora, 0));
    c.fillStyle = curtain;
    c.beginPath();
    c.ellipse(0, middle, radius * 0.6, radius * 0.28, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** Half a ring, the far half (`behind`) or the near one, in its style. */
function drawRing(
  c: CanvasRenderingContext2D,
  planet: Planet,
  ring: PlanetRing,
  x: number,
  y: number,
  radius: number,
  view: PlanetView,
  behind: boolean,
) {
  const from = behind ? Math.PI : 0;
  const to = behind ? Math.PI * 2 : Math.PI;
  const across = radius * (1.5 + 0.4 * ring.amount);
  const color = (alpha: number, lighter = 0) =>
    ring.tinted ? withAlpha(view.tint, alpha) : hsl(planet.colors.ring, alpha, lighter);
  const stroke = (reach: number, width: number, style: string) => {
    c.strokeStyle = style;
    c.lineWidth = width;
    c.beginPath();
    c.ellipse(x, y, reach, reach * ring.flat, ring.tilt, from, to);
    c.stroke();
  };
  const onRing = (angle: number, reach = across) =>
    leaned(x, y, Math.cos(angle) * reach, Math.sin(angle) * reach * ring.flat, ring.tilt);
  const strength = Math.min(1, ring.amount + 0.2);
  c.lineCap = 'butt';
  switch (ring.style) {
    case 'single':
    case 'frosted': {
      const width = radius * (0.08 + 0.2 * ring.amount);
      stroke(across, width, color(0.42 * strength));
      // A wide ring gets a dark gap through it, like Saturn's.
      if (ring.amount > 0.5 && ring.style === 'single') stroke(across, width * 0.12, 'rgb(6 9 20 / 0.45)');
      if (ring.style === 'frosted') {
        // Icicles hanging from its lower edge.
        c.fillStyle = color(0.75 * strength, 10);
        for (let i = 0; i < icicles; i++) {
          const angle = (i / icicles) * Math.PI * 2 + noise(i) * 0.15;
          if (Math.sin(angle) < 0 !== behind) continue;
          const top = onRing(angle);
          const long = radius * (0.05 + 0.12 * noise(i + 50)) * ring.amount;
          const wide = radius * 0.025;
          c.beginPath();
          c.moveTo(top.x - wide, top.y + width * 0.3);
          c.lineTo(top.x + wide, top.y + width * 0.3);
          c.lineTo(top.x, top.y + width * 0.3 + long);
          c.closePath();
          c.fill();
        }
      }
      break;
    }
    case 'stacked':
      // Thin rings one outside another, each a little fainter.
      for (let layer = 0; layer < ring.layers; layer++) {
        const reach = radius * (1.4 + layer * (0.12 + 0.06 * ring.amount));
        stroke(reach, radius * 0.05, color((0.5 - 0.06 * layer) * strength));
      }
      break;
    case 'halo':
      // A wide, faint haze with a brighter inner edge.
      stroke(across + radius * 0.2, radius * (0.45 + 0.4 * ring.amount), color(0.14 * Math.min(1, ring.amount + 0.3)));
      stroke(across - radius * 0.1, radius * 0.03, color(0.35 * ring.amount, 6));
      break;
    case 'clumpy': {
      // A broken ring of tiny moonlets, slowly going round.
      c.fillStyle = color(0.7 * strength);
      const count = Math.round(moonlets * (0.5 + 0.5 * ring.amount));
      for (let i = 0; i < count; i++) {
        if (i % 7 === 3 || i % 11 === 5) continue;
        const angle = (i / count) * Math.PI * 2 + view.turn * 3;
        if (Math.sin(angle) < 0 !== behind) continue;
        const at = onRing(angle, across * (1 + 0.06 * (((i * 0.618) % 1) - 0.5)));
        c.beginPath();
        c.arc(at.x, at.y, radius * (0.035 + 0.035 * ((i * 0.381) % 1)), 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'electric': {
      // A faint ring with lightning crackling along it, jumping about while exploring.
      stroke(across, radius * 0.05, color(0.25 * strength, 10));
      const flash = view.lively ? Math.floor(view.time / lightningMs) : 0;
      const bolts = 3 + Math.round(3 * ring.amount);
      for (let bolt = 0; bolt < bolts; bolt++) {
        const start = noise(bolt * 7.3 + flash * 3.1) * Math.PI * 2;
        const points = Array.from({ length: 9 }, (_, i) => {
          const angle = start + i * 0.09;
          const jolt = (noise(bolt * 13 + i * 3.7 + flash) - 0.5) * radius * 0.16;
          return { ...onRing(angle, across + jolt), behind: Math.sin(angle) < 0 };
        });
        for (const [width, alpha] of [
          [0.09, 0.22],
          [0.025, 0.95],
        ] as const) {
          c.strokeStyle = color(alpha * strength, 18);
          c.lineWidth = radius * width;
          c.lineJoin = 'round';
          c.beginPath();
          let drawing = false;
          for (const p of points) {
            if (p.behind !== behind) {
              drawing = false;
              continue;
            }
            if (drawing) c.lineTo(p.x, p.y);
            else c.moveTo(p.x, p.y);
            drawing = true;
          }
          c.stroke();
        }
      }
      break;
    }
  }
}

/** Half of a forming planet's swirling disk of dust: a faint haze with specks in it. */
function drawDust(
  c: CanvasRenderingContext2D,
  planet: Planet,
  x: number,
  y: number,
  radius: number,
  turn: number,
  behind: boolean,
) {
  const across = radius * 1.9;
  const flat = 0.32;
  c.lineCap = 'butt';
  c.strokeStyle = hsl(planet.colors.body, 0.14 * planet.dust, 14);
  c.lineWidth = radius * 0.9;
  c.beginPath();
  c.ellipse(x, y, across, across * flat, planet.tilt, behind ? Math.PI : 0, behind ? Math.PI * 2 : Math.PI);
  c.stroke();
  c.fillStyle = hsl(planet.colors.body, 0.75 * planet.dust, 22);
  for (let i = 0; i < dustSpecks; i++) {
    const reach = across * (0.75 + 0.5 * ((i * 0.618) % 1));
    // Inner specks go round faster.
    const angle = i * goldenAngle + (turn * 8) / (reach / radius);
    if (Math.sin(angle) < 0 !== behind) continue;
    const at = leaned(x, y, Math.cos(angle) * reach, Math.sin(angle) * reach * flat, planet.tilt);
    c.beginPath();
    c.arc(at.x, at.y, radius * (0.025 + 0.03 * ((i * 0.381) % 1)), 0, Math.PI * 2);
    c.fill();
  }
}

/** The moons on one side of the planet: lit from the top left, some with a crater or two. */
function drawMoons(
  c: CanvasRenderingContext2D,
  moons: { moon: Planet['moons'][number]; x: number; y: number; behind: boolean }[],
  radius: number,
  behind: boolean,
) {
  for (const { moon, x, y, behind: back } of moons) {
    if (back !== behind) continue;
    const size = Math.max(1.5, moon.size * radius);
    const lit = c.createRadialGradient(x - size * 0.4, y - size * 0.4, 0, x, y, size * 1.2);
    lit.addColorStop(0, hsl(moon.color, 1, 12));
    lit.addColorStop(1, hsl(moon.color, 1, -38));
    c.fillStyle = lit;
    c.beginPath();
    c.arc(x, y, size, 0, Math.PI * 2);
    c.fill();
    if (moon.craters && size > 3) {
      c.fillStyle = hsl(moon.color, 0.45, -28);
      c.beginPath();
      c.arc(x + size * 0.25, y - size * 0.1, size * 0.28, 0, Math.PI * 2);
      c.moveTo(x - size * 0.19, y + size * 0.35);
      c.arc(x - size * 0.35, y + size * 0.35, size * 0.16, 0, Math.PI * 2);
      c.fill();
    }
  }
}
