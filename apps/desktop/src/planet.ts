import type { Hsl, Planet, PlanetRing } from '@lock-in/core';

// Draws one planet on the night sky's canvas (PLAN §5). The planet's kind, form, rings and other
// details come from the reward engine (packages/core/src/planets.ts); this turns them into
// shapes, lit from the top left. Surface features sit at a longitude, so they turn with the
// planet as it spins, and the far half of each ring, dust disk and moon orbit goes behind it.

const goldenAngle = Math.PI * (3 - Math.sqrt(5));
/** How many specks of dust swirl around a planet that's still forming. */
const dustSpecks = 40;
/** How many moonlets make up a clumpy ring. */
const moonlets = 56;
/** How much faster moons go round than planets do, for a moon two planet radii out. */
const moonSpeed = 6;

/** Where and how to draw a planet. */
export interface PlanetView {
  /** Its middle and radius, in canvas pixels. */
  x: number;
  y: number;
  radius: number;
  alpha: number;
  /** How much it shines from being hovered, from 0 to 1. */
  glow: number;
  /** The star color of the month's top profile, which tints its glow ("#rrggbb"). */
  tint: string;
  /** How far the sky has turned while exploring, in radians: planets spin and moons go round with it. */
  turn: number;
  /** For the aurora's shimmer (ms), and whether to hold it still for reduced motion. */
  time: number;
  still: boolean;
}

export const hsl = ([h, s, l]: Hsl, alpha = 1, lighter = 0) =>
  `hsl(${h} ${s}% ${Math.min(100, Math.max(0, l + lighter))}% / ${alpha})`;

/** A "#rrggbb" color with an alpha from 0 to 1. */
const withAlpha = (hex: string, alpha: number) =>
  `${hex}${Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

export function drawPlanet(c: CanvasRenderingContext2D, planet: Planet, view: PlanetView) {
  const { x, y, radius, glow, turn } = view;
  // A planet still forming is a smaller core inside its dust.
  const core = planet.form === 'dust' ? radius * 0.6 : radius;
  c.globalAlpha = view.alpha;

  // A soft glow in the top profile's color, stronger with an atmosphere and while hovered.
  const halo = 0.16 + 0.34 * planet.glow + 0.25 * glow;
  const outer = core * (1.3 + 0.3 * planet.glow);
  const light = c.createRadialGradient(x, y, core * 0.85, x, y, outer);
  light.addColorStop(0, withAlpha(view.tint, halo));
  light.addColorStop(1, withAlpha(view.tint, 0));
  c.fillStyle = light;
  c.beginPath();
  c.arc(x, y, outer, 0, Math.PI * 2);
  c.fill();

  const moons = planet.moons.map((moon) => {
    const angle = moon.angle + (turn * moonSpeed * 2) / moon.orbit;
    const across = Math.cos(angle) * moon.orbit * radius;
    const down = Math.sin(angle) * moon.orbit * radius * 0.32;
    return { moon, ...leaned(x, y, across, down, planet.tilt), behind: Math.sin(angle) < 0 };
  });

  // The far halves first, then the planet, then the near halves over it.
  drawMoons(c, moons, radius, true);
  if (planet.dust > 0) drawDust(c, planet, x, y, radius, turn, true);
  for (const ring of planet.rings) drawRing(c, planet, ring, x, y, radius, turn, true);

  drawBody(c, planet, x, y, core, turn);
  if (planet.aurora > 0) drawAurora(c, planet, x, y, core, view);

  for (const ring of planet.rings) drawRing(c, planet, ring, x, y, radius, turn, false);
  if (planet.dust > 0) drawDust(c, planet, x, y, radius, turn, false);
  drawMoons(c, moons, radius, false);
}

/** Where a point `across` and `down` from a planet's middle ends up, leaning with the planet. */
function leaned(x: number, y: number, across: number, down: number, tilt: number) {
  return {
    x: x + across * Math.cos(tilt) - down * Math.sin(tilt),
    y: y + across * Math.sin(tilt) + down * Math.cos(tilt),
  };
}

/** The planet's outline: lumpy while it's forming, then round, flattened a little at the poles. */
function outline(c: CanvasRenderingContext2D, planet: Planet, x: number, y: number, radius: number) {
  c.beginPath();
  if (planet.lumpiness > 0) {
    // A smooth curve through bumps evenly round it.
    const points = planet.outline.map((bump, i) => {
      const angle = (i / planet.outline.length) * Math.PI * 2;
      const reach = radius * (1 + 0.16 * planet.lumpiness * bump);
      return { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach };
    });
    const middle = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });
    const start = middle(points[points.length - 1]!, points[0]!);
    c.moveTo(start.x, start.y);
    points.forEach((point, i) => {
      const next = middle(point, points[(i + 1) % points.length]!);
      c.quadraticCurveTo(point.x, point.y, next.x, next.y);
    });
    c.closePath();
  } else {
    c.ellipse(x, y, radius, radius * (1 - 0.1 * planet.flattening), planet.tilt, 0, Math.PI * 2);
  }
}

function drawBody(c: CanvasRenderingContext2D, planet: Planet, x: number, y: number, radius: number, turn: number) {
  const { body, detail } = planet.colors;
  c.save();
  outline(c, planet, x, y, radius);
  c.clip();
  const surface = c.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 0, x, y, radius * 1.3);
  surface.addColorStop(0, hsl(body, 1, 12));
  surface.addColorStop(0.6, hsl(body));
  surface.addColorStop(1, hsl(body, 1, -16));
  c.fillStyle = surface;
  c.fillRect(x - radius * 1.3, y - radius * 1.3, radius * 2.6, radius * 2.6);

  // Its surface, leaning with it.
  c.save();
  c.translate(x, y);
  c.rotate(planet.tilt);
  for (const band of planet.bands) {
    const middle = band.at * radius;
    const half = band.width * radius * 0.13;
    const stripe = c.createLinearGradient(0, middle - half, 0, middle + half);
    const strength = planet.kind === 'gas' ? 0.55 : 0.3;
    stripe.addColorStop(0, hsl(detail, 0));
    stripe.addColorStop(0.5, hsl(detail, strength));
    stripe.addColorStop(1, hsl(detail, 0));
    c.fillStyle = stripe;
    c.fillRect(-radius, middle - half, radius * 2, half * 2);
  }
  const spin = turn * planet.spin;
  if (planet.kind !== 'ember') {
    for (const feature of planet.features) drawFeature(c, planet, feature, radius, spin);
  }
  if (planet.storm) drawStorm(c, planet, radius, spin);
  if (planet.caps > 0) {
    const cap = planet.kind === 'ice' ? hsl(detail, 0.9, 6) : hsl([body[0], 15, 94], 0.85);
    c.fillStyle = cap;
    for (const pole of [-1, 1]) {
      c.beginPath();
      c.ellipse(0, pole * radius * 0.97, radius * 0.5 * planet.caps, radius * 0.2 * planet.caps, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();

  // Its night side, away from the light.
  const night = c.createRadialGradient(
    x - radius * 0.45,
    y - radius * 0.45,
    radius * 0.4,
    x - radius * 0.2,
    y - radius * 0.2,
    radius * 1.7,
  );
  night.addColorStop(0, 'rgb(6 9 20 / 0)');
  night.addColorStop(1, 'rgb(6 9 20 / 0.85)');
  c.fillStyle = night;
  c.fillRect(x - radius * 1.3, y - radius * 1.3, radius * 2.6, radius * 2.6);

  // An ember world's cracks glow through its night side.
  if (planet.kind === 'ember') {
    c.translate(x, y);
    c.rotate(planet.tilt);
    for (const feature of planet.features) drawFeature(c, planet, feature, radius, spin);
  }
  c.restore();
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

/** A crater, cloud, swirl or glowing crack, by the planet's kind. */
function drawFeature(
  c: CanvasRenderingContext2D,
  planet: Planet,
  feature: Planet['features'][number],
  radius: number,
  spin: number,
) {
  const at = seen(feature.lon, feature.lat, radius, spin);
  if (!at) return;
  const size = feature.size * radius;
  const { detail } = planet.colors;
  switch (planet.kind) {
    case 'rocky':
      // A dark bowl with a lit rim.
      c.fillStyle = hsl(detail, 0.6);
      c.beginPath();
      c.ellipse(at.across, at.down, size * 0.6 * at.facing, size * 0.6, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = hsl(planet.colors.body, 0.45, 16);
      c.lineWidth = size * 0.12;
      c.beginPath();
      c.ellipse(at.across, at.down, size * 0.6 * at.facing, size * 0.6, 0, Math.PI * 0.6, Math.PI * 1.6);
      c.stroke();
      break;
    case 'ocean': {
      // A soft white cloud, stretched by the winds.
      const cloud = c.createRadialGradient(at.across, at.down, 0, at.across, at.down, size * 1.4);
      cloud.addColorStop(0, hsl(detail, 0.75));
      cloud.addColorStop(1, hsl(detail, 0));
      c.fillStyle = cloud;
      c.beginPath();
      c.ellipse(at.across, at.down, size * 1.6 * at.facing, size * 0.6, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'ice':
      // A pale swirl.
      c.strokeStyle = hsl(detail, 0.55);
      c.lineWidth = size * 0.18;
      for (const turnOf of [0.5, 0.85]) {
        c.beginPath();
        c.ellipse(at.across, at.down, size * turnOf * at.facing, size * turnOf * 0.6, 0, 0, Math.PI * 1.4);
        c.stroke();
      }
      break;
    case 'ember': {
      // A jagged glowing crack: a wide faint glow under a bright thin line.
      const points = Array.from({ length: 5 }, (_, i) => ({
        x: at.across + (i - 2) * size * 0.5 * at.facing,
        y: at.down + Math.sin(feature.lon * 7 + i * 2.3) * size * 0.35,
      }));
      for (const [width, alpha] of [
        [0.5, 0.25],
        [0.14, 0.95],
      ] as const) {
        c.strokeStyle = hsl(detail, alpha);
        c.lineWidth = size * width;
        c.beginPath();
        points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.stroke();
      }
      break;
    }
    case 'gas':
      break;
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

/** Curtains of light at the poles, shimmering slowly. */
function drawAurora(
  c: CanvasRenderingContext2D,
  planet: Planet,
  x: number,
  y: number,
  radius: number,
  view: PlanetView,
) {
  const shimmer = view.still ? 1 : 0.75 + 0.25 * Math.sin(view.time / 1300 + planet.monthStart);
  c.save();
  c.translate(x, y);
  c.rotate(planet.tilt);
  for (const [pole, strength] of [
    [-1, 1],
    [1, 0.5],
  ] as const) {
    const middle = pole * radius * 0.92;
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
  turn: number,
  behind: boolean,
) {
  const from = behind ? Math.PI : 0;
  const to = behind ? Math.PI * 2 : Math.PI;
  const across = radius * (1.5 + 0.4 * ring.amount);
  const color = planet.colors.ring;
  const stroke = (reach: number, width: number, style: string) => {
    c.strokeStyle = style;
    c.lineWidth = width;
    c.beginPath();
    c.ellipse(x, y, reach, reach * ring.flat, ring.tilt, from, to);
    c.stroke();
  };
  switch (ring.style) {
    case 'single': {
      const width = radius * (0.08 + 0.2 * ring.amount);
      stroke(across, width, hsl(color, 0.42 * Math.min(1, ring.amount + 0.2)));
      // A wide ring gets a dark gap through it, like Saturn's.
      if (ring.amount > 0.5) stroke(across, width * 0.12, 'rgb(6 9 20 / 0.45)');
      break;
    }
    case 'stacked':
      // Thin rings one outside another, each a little fainter.
      for (let layer = 0; layer < ring.layers; layer++) {
        const reach = radius * (1.4 + layer * (0.12 + 0.06 * ring.amount));
        stroke(reach, radius * 0.05, hsl(color, (0.5 - 0.06 * layer) * Math.min(1, ring.amount + 0.2)));
      }
      break;
    case 'halo':
      // A wide, faint haze with a brighter inner edge.
      stroke(
        across + radius * 0.2,
        radius * (0.45 + 0.4 * ring.amount),
        hsl(color, 0.14 * Math.min(1, ring.amount + 0.3)),
      );
      stroke(across - radius * 0.1, radius * 0.03, hsl(color, 0.35 * ring.amount, 6));
      break;
    case 'clumpy': {
      // A broken ring of tiny moonlets, slowly going round.
      c.fillStyle = hsl(color, 0.7 * Math.min(1, ring.amount + 0.2));
      const count = Math.round(moonlets * (0.5 + 0.5 * ring.amount));
      for (let i = 0; i < count; i++) {
        if (i % 7 === 3 || i % 11 === 5) continue;
        const angle = (i / count) * Math.PI * 2 + turn * 3;
        if (Math.sin(angle) < 0 !== behind) continue;
        const wobble = ((i * 0.618) % 1) - 0.5;
        const reach = across * (1 + 0.06 * wobble);
        const at = leaned(x, y, Math.cos(angle) * reach, Math.sin(angle) * reach * ring.flat, ring.tilt);
        const size = radius * (0.035 + 0.035 * ((i * 0.381) % 1));
        c.beginPath();
        c.arc(at.x, at.y, size, 0, Math.PI * 2);
        c.fill();
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
