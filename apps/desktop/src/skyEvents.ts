import type { Comet, RareEvent, RareEventKind } from '@lock-in/core';

// Comets and rare events on the night sky's canvas (PLAN §5). They come from the reward engine
// (packages/core/src/events.ts); this draws them. Each plays once, gently, the first time the Sky
// shows it. Comets and supernovae then stay beside their week's constellation, as a faint comet
// and a small nebula. Under reduced motion nothing moves: what stays just appears, and a passing
// shooting star, meteor shower or aurora shows still and fades away.

/** How long each plays the first time it's shown (ms). */
export const playMs: Record<RareEventKind | 'comet', number> = {
  shootingStar: 1800,
  meteorShower: 6500,
  aurora: 14_000,
  supernova: 7000,
  moonCrash: 2600,
  split: 2600,
  shatter: 3600,
  comet: 3200,
};
/** How many meteors a meteor shower has. */
const meteors = 11;
/** How many strips of light make up each curtain of an aurora. */
const auroraStrips = 90;

const clamp = (t: number) => Math.min(1, Math.max(0, t));
/** Eases from 0 to 1, fast at first and slowing to a stop. */
const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
/** From 0 to 1 between `from` and `to`, smoothly. */
const smooth = (from: number, to: number, t: number) => {
  const x = clamp((t - from) / (to - from));
  return x * x * (3 - 2 * x);
};
/** Fades in over the first `fadeIn` of `played`, and out over the last `fadeOut`. */
const fade = (played: number, fadeIn: number, fadeOut: number) =>
  smooth(0, fadeIn, played) * (1 - smooth(1 - fadeOut, 1, played));

/** A number from 0 to 1 that's always the same for the same `n`. */
function noise(n: number): number {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Something passing through the whole sky: a shooting star, a meteor shower or an aurora, `played`
 * of the way through (0 to 1). `time` is for the aurora's slow sway.
 */
export function drawPassing(
  c: CanvasRenderingContext2D,
  event: RareEvent,
  played: number,
  width: number,
  height: number,
  time: number,
  still: boolean,
) {
  if (event.kind === 'shootingStar') drawShootingStar(c, event, played, width, height, still);
  else if (event.kind === 'meteorShower') drawMeteorShower(c, event, played, width, height, still);
  else if (event.kind === 'aurora') drawAurora(c, event, played, width, height, still ? 0 : time);
}

/** A bright head with a tail fading behind it, heading `angle` (radians). */
function streak(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  alpha: number,
) {
  if (alpha <= 0.01 || length <= 0) return;
  const tailX = x - Math.cos(angle) * length;
  const tailY = y - Math.sin(angle) * length;
  const tail = c.createLinearGradient(x, y, tailX, tailY);
  tail.addColorStop(0, `rgb(255 252 240 / ${alpha})`);
  tail.addColorStop(0.25, `rgb(200 220 255 / ${0.45 * alpha})`);
  tail.addColorStop(1, 'rgb(200 220 255 / 0)');
  c.strokeStyle = tail;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(tailX, tailY);
  c.stroke();
  c.lineCap = 'butt';
  const head = c.createRadialGradient(x, y, 0, x, y, width * 4);
  head.addColorStop(0, `rgb(255 255 255 / ${alpha})`);
  head.addColorStop(1, 'rgb(220 230 255 / 0)');
  c.fillStyle = head;
  c.beginPath();
  c.arc(x, y, width * 4, 0, Math.PI * 2);
  c.fill();
}

/** Which way a shooting star or meteors fall: a little below level, to the right or left. */
function heading(event: RareEvent): number {
  const along = (event.angle % Math.PI) / Math.PI;
  const dip = 0.3 + 0.4 * along;
  return event.angle < Math.PI ? dip : Math.PI - dip;
}

function drawShootingStar(
  c: CanvasRenderingContext2D,
  event: RareEvent,
  played: number,
  width: number,
  height: number,
  still: boolean,
) {
  const angle = heading(event);
  const scale = Math.min(width, height);
  const startX = (0.15 + 0.7 * event.x) * width;
  const startY = (0.06 + 0.3 * event.y) * height;
  const travel = 0.45 * scale;
  const gone = still ? 0.5 : easeOut(played * 1.15);
  const x = startX + Math.cos(angle) * travel * gone;
  const y = startY + Math.sin(angle) * travel * gone;
  const length = scale * (still ? 0.14 : 0.18 * Math.sin(Math.PI * clamp(played * 1.1)));
  const alpha = still ? 1 - played : fade(played, 0.08, 0.35);
  streak(c, x, y, angle, length, scale * 0.0035, alpha);
}

function drawMeteorShower(
  c: CanvasRenderingContext2D,
  event: RareEvent,
  played: number,
  width: number,
  height: number,
  still: boolean,
) {
  const scale = Math.min(width, height);
  // They all seem to come from one spot high in the sky.
  const fromX = (0.2 + 0.6 * event.x) * width;
  const fromY = (0.04 + 0.18 * event.y) * height;
  const base = heading(event);
  for (let i = 0; i < meteors; i++) {
    const angle = base + (noise(i + event.hue) - 0.5) * 1.3;
    const startOut = scale * (0.04 + 0.22 * noise(i * 3.3 + event.x));
    // Each one starts a little after the last and lasts a moment.
    const begins = (i / meteors) * 0.78;
    const own = (played - begins) / 0.2;
    if (!still && (own <= 0 || own >= 1)) continue;
    const gone = still ? 0.5 : easeOut(own);
    const out = startOut + scale * 0.2 * gone;
    const x = fromX + Math.cos(angle) * out;
    const y = fromY + Math.sin(angle) * out;
    const length = scale * (still ? 0.07 : 0.1 * Math.sin(Math.PI * own));
    const alpha = still ? (1 - played) * (0.5 + 0.5 * noise(i)) : fade(own, 0.1, 0.4) * (0.6 + 0.4 * noise(i * 7));
    streak(c, x, y, angle, length, scale * 0.0025, alpha);
  }
}

/**
 * Curtains of green or violet light across the top of the sky, swaying slowly: thin strips of
 * light, brightest at their lower edge and fading upward, some brighter than others like rays.
 */
function drawAurora(
  c: CanvasRenderingContext2D,
  event: RareEvent,
  played: number,
  width: number,
  height: number,
  time: number,
) {
  const strength = fade(played, 0.2, 0.3);
  if (strength <= 0.01) return;
  const green = event.hue < 240;
  const hue = green ? 135 + (event.hue / 240) * 30 : 280 + ((event.hue - 240) / 120) * 30;
  const t = time / 1000;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let band = 0; band < 2; band++) {
    const tall = height * (0.22 - 0.06 * band);
    const often = 1.4 + band * 0.8 + event.x;
    const fringe = hue + 60 + band * 10;
    for (let strip = 0; strip < auroraStrips; strip++) {
      const left = Math.floor((strip / auroraStrips) * width);
      const right = Math.floor(((strip + 1) / auroraStrips) * width);
      const across = (left + right) / 2 / width;
      const foot =
        height * (0.2 + 0.07 * band) +
        height * 0.05 * Math.sin(across * often * Math.PI + t * (0.2 + 0.08 * band) + band * 2.3);
      // Rays: brighter and fainter stretches, drifting slowly along it.
      const ray =
        0.5 + 0.3 * Math.sin(across * 23 + band * 4 + t * 0.5) + 0.2 * Math.sin(across * 61 + band * 9 - t * 0.35);
      // Fading out toward both sides of the sky.
      const sides = Math.sin(Math.PI * across) ** 0.6;
      const alpha = strength * ray * sides * (band ? 0.6 : 1);
      const light = c.createLinearGradient(0, foot - tall, 0, foot + tall * 0.1);
      light.addColorStop(0, `hsl(${fringe} 80% 64% / 0)`);
      light.addColorStop(0.55, `hsl(${fringe} 70% 62% / ${0.1 * alpha})`);
      light.addColorStop(0.9, `hsl(${hue} 85% 66% / ${0.34 * alpha})`);
      light.addColorStop(1, `hsl(${hue} 85% 66% / 0)`);
      c.fillStyle = light;
      c.fillRect(left, foot - tall, right - left, tall * 1.1);
    }
  }
  c.restore();
}

/**
 * A supernova at `x`, `y` (canvas pixels) in a constellation whose unit is `unit` pixels: a star
 * flaring up and fading into a small nebula, which stays. `played` undefined means it's done.
 */
export function drawSupernova(
  c: CanvasRenderingContext2D,
  event: RareEvent,
  x: number,
  y: number,
  unit: number,
  alpha: number,
  played?: number,
) {
  const grown = played === undefined ? 1 : smooth(0.1, 0.85, played);
  // The nebula: a few soft clouds of color, drifting apart from where the star was.
  for (let cloud = 0; cloud < 3; cloud++) {
    const angle = event.angle + cloud * 2.1;
    const out = unit * 0.09 * grown * (1 + cloud * 0.4);
    const cx = x + Math.cos(angle) * out;
    const cy = y + Math.sin(angle) * out;
    const reach = unit * (0.16 + 0.07 * cloud) * (0.4 + 0.6 * grown);
    const hue = (event.hue + [0, 30, -25][cloud]! + 360) % 360;
    const light = c.createRadialGradient(cx, cy, 0, cx, cy, reach);
    light.addColorStop(0, `hsl(${hue} 70% 66% / ${0.2 * grown * alpha})`);
    light.addColorStop(1, `hsl(${hue} 70% 66% / 0)`);
    c.fillStyle = light;
    c.beginPath();
    c.arc(cx, cy, reach, 0, Math.PI * 2);
    c.fill();
  }
  // What's left of the star, small and bright in the middle.
  const core = c.createRadialGradient(x, y, 0, x, y, unit * 0.04);
  core.addColorStop(0, `rgb(255 250 240 / ${0.8 * grown * alpha})`);
  core.addColorStop(1, 'rgb(255 250 240 / 0)');
  c.fillStyle = core;
  c.beginPath();
  c.arc(x, y, unit * 0.04, 0, Math.PI * 2);
  c.fill();
  if (played === undefined) return;
  // The flare: bright quickly, then fading slowly, with spikes of light.
  const flare = played < 0.12 ? played / 0.12 : Math.exp(-(played - 0.12) * 5);
  const reach = unit * (0.06 + 0.3 * flare);
  const light = c.createRadialGradient(x, y, 0, x, y, reach);
  light.addColorStop(0, `rgb(255 255 255 / ${flare * alpha})`);
  light.addColorStop(0.3, `hsl(${event.hue} 80% 80% / ${0.5 * flare * alpha})`);
  light.addColorStop(1, `hsl(${event.hue} 80% 80% / 0)`);
  c.fillStyle = light;
  c.beginPath();
  c.arc(x, y, reach, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `rgb(255 255 255 / ${0.6 * flare * alpha})`;
  c.lineWidth = Math.max(1, unit * 0.006);
  c.beginPath();
  for (const angle of [0, Math.PI / 2]) {
    const spike = reach * 1.8;
    c.moveTo(x - Math.cos(angle) * spike, y - Math.sin(angle) * spike);
    c.lineTo(x + Math.cos(angle) * spike, y + Math.sin(angle) * spike);
  }
  c.stroke();
}

/**
 * A comet with its head at `x`, `y` (canvas pixels) in a constellation whose unit is `unit` pixels,
 * its tails streaming away. The first time, it glides in head first. `played` undefined means
 * it's done.
 */
export function drawComet(
  c: CanvasRenderingContext2D,
  comet: Comet,
  x: number,
  y: number,
  unit: number,
  alpha: number,
  played?: number,
) {
  const arrived = played === undefined ? 1 : easeOut(played);
  const shown = alpha * (played === undefined ? 1 : smooth(0, 0.3, played));
  if (shown <= 0.01) return;
  // It comes in from behind its tail.
  const back = unit * 1.4 * (1 - arrived);
  const hx = x + Math.cos(comet.angle) * back;
  const hy = y + Math.sin(comet.angle) * back;
  const length = comet.length * unit;
  // A wide dusty tail, and a narrow straight one beside it.
  for (const [turn, wide, strength, hue] of [
    [0.1, 0.1, 0.38, comet.hue - 20],
    [-0.04, 0.035, 0.45, comet.hue],
  ] as const) {
    const angle = comet.angle + turn;
    const tipX = hx + Math.cos(angle) * length;
    const tipY = hy + Math.sin(angle) * length;
    const side = { x: -Math.sin(angle) * length * wide, y: Math.cos(angle) * length * wide };
    const tail = c.createLinearGradient(hx, hy, tipX, tipY);
    tail.addColorStop(0, `hsl(${hue} 60% 85% / ${strength * shown})`);
    tail.addColorStop(1, `hsl(${hue} 60% 85% / 0)`);
    c.fillStyle = tail;
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(tipX + side.x, tipY + side.y);
    c.lineTo(tipX - side.x, tipY - side.y);
    c.closePath();
    c.fill();
  }
  const reach = unit * 0.06;
  const head = c.createRadialGradient(hx, hy, 0, hx, hy, reach);
  head.addColorStop(0, `rgb(255 255 255 / ${shown})`);
  head.addColorStop(0.35, `hsl(${comet.hue} 70% 85% / ${0.6 * shown})`);
  head.addColorStop(1, `hsl(${comet.hue} 70% 85% / 0)`);
  c.fillStyle = head;
  c.beginPath();
  c.arc(hx, hy, reach, 0, Math.PI * 2);
  c.fill();
}
