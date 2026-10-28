import { seeded } from '@lock-in/core';

// The Milky Way (PLAN §5): a soft band of glow across the sky, behind everything, that fills in
// slowly as total focus grows. It's drawn by code once into an image a little bigger than the sky
// (so exploring can pan and zoom over it) and stamped every frame, and only drawn again when it
// fills in a little more or the window changes size. Light pollution washes it out first, as it
// does outside.

/** How much bigger than the sky its image is, so panning while exploring doesn't reach the edge. */
const room = 1.6;
/** Its image is drawn at a lower resolution than the sky, since it's all soft glow. */
const resolution = 0.5;
/** Which way the band runs, rising to the right, and how wide it is, as a share of the image's diagonal. */
const tilt = -0.5;
const width = 0.07;
/** How much more it has to fill in before a puff of glow or a speck shows fully. */
const fadeIn = 0.08;

interface Puff {
  /** Along the band and across it, as shares of the image's diagonal. */
  along: number;
  across: number;
  size: number;
  color: string;
  alpha: number;
  /** How filled in the Milky Way is when it starts to show, from 0 to 1. */
  from: number;
  /** A dark lane of dust instead of glow. */
  dark?: boolean;
}

const colors = ['143 166 255', '185 163 255', '255 214 174', '242 182 207', '207 224 255'];

/** Roughly bell-shaped, from -1.5 to 1.5, mostly near 0. */
const bell = (random: () => number) => random() + random() + random() - 1.5;

/** The puffs, dust lanes and specks it's made of, the same every time. */
function made(): { puffs: Puff[]; specks: Puff[] } {
  const random = seeded('milky-way');
  const puffs: Puff[] = [];
  for (let i = 0; i < 240; i++) {
    const across = bell(random) * width;
    puffs.push({
      along: random() * 1.1 - 0.55,
      across,
      size: 0.03 + random() * 0.07,
      color: colors[Math.floor(random() * colors.length)]!,
      alpha: 0.05 + random() * 0.08,
      // The middle of the band first, then out to its edges.
      from: Math.min(0.92, random() * 0.6 + (Math.abs(across) / width) * 0.25),
    });
  }
  for (let i = 0; i < 36; i++) {
    puffs.push({
      along: random() * 0.9 - 0.45,
      across: bell(random) * width * 0.35,
      size: 0.012 + random() * 0.03,
      color: '6 9 20',
      alpha: 0.25 + random() * 0.25,
      from: 0.3 + random() * 0.6,
      dark: true,
    });
  }
  const specks: Puff[] = [];
  for (let i = 0; i < 1400; i++) {
    specks.push({
      along: random() * 1.1 - 0.55,
      across: bell(random) * width * 0.8,
      size: 0.4 + random() * 0.9,
      color: colors[Math.floor(random() * colors.length)]!,
      alpha: 0.25 + random() * 0.55,
      from: random(),
    });
  }
  return { puffs, specks };
}

let parts: ReturnType<typeof made> | undefined;
let image: { canvas: HTMLCanvasElement; key: string } | undefined;

/** How much of a puff or speck shows when the Milky Way is `fill` filled in, from 0 to 1. */
const showing = (puff: Puff, fill: number) => Math.min(1, Math.max(0, (fill - puff.from) / fadeIn));

/** Its image for a sky `skyWidth` by `skyHeight` pixels, `fill` filled in. */
function drawn(skyWidth: number, skyHeight: number, fill: number): HTMLCanvasElement {
  const w = Math.round(skyWidth * room * resolution);
  const h = Math.round(skyHeight * room * resolution);
  const key = `${w}x${h}:${Math.round(fill * 400)}`;
  if (image?.key === key) return image.canvas;
  parts ??= made();
  const canvas = image?.canvas ?? document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  const diagonal = Math.hypot(w, h);
  const middle = { x: w / 2, y: h * 0.46 };
  const at = (puff: Puff) => ({
    x: middle.x + (Math.cos(tilt) * puff.along - Math.sin(tilt) * puff.across) * diagonal,
    y: middle.y + (Math.sin(tilt) * puff.along + Math.cos(tilt) * puff.across) * diagonal,
  });
  for (const puff of parts.puffs) {
    const shows = showing(puff, fill);
    if (shows <= 0) continue;
    const { x, y } = at(puff);
    const radius = puff.size * diagonal;
    const glow = c.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgb(${puff.color} / ${puff.alpha * shows})`);
    glow.addColorStop(1, `rgb(${puff.color} / 0)`);
    c.fillStyle = glow;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const scale = (window.devicePixelRatio || 1) * resolution;
  for (const speck of parts.specks) {
    const shows = showing(speck, fill);
    if (shows <= 0) continue;
    const { x, y } = at(speck);
    c.fillStyle = `rgb(${speck.color} / ${speck.alpha * shows})`;
    c.beginPath();
    c.arc(x, y, speck.size * scale, 0, Math.PI * 2);
    c.fill();
  }
  image = { canvas, key };
  return canvas;
}

export interface MilkyWayView {
  /** How filled in it is, from 0 to 1. */
  fill: number;
  alpha: number;
  /** Where exploring has panned to (the middle of the view, as shares of the sky) and how far in. */
  x: number;
  y: number;
  zoom: number;
}

/** Draws the Milky Way over the whole sky, `c`'s canvas. */
export function drawMilkyWay(c: CanvasRenderingContext2D, view: MilkyWayView) {
  if (view.fill <= 0 || view.alpha <= 0.01) return;
  const { width, height } = c.canvas;
  const canvas = drawn(width, height, view.fill);
  // It's far away, so it moves and grows only a little as you pan and zoom.
  const grow = view.zoom ** 0.15;
  const w = width * room * grow;
  const h = height * room * grow;
  // Never so far that its edge shows.
  const most = (room * grow - 1) / 2;
  const shift = (by: number) => Math.min(most, Math.max(-most, (by - 0.5) * 0.15));
  const x = width / 2 - shift(view.x) * width - w / 2;
  const y = height / 2 - shift(view.y) * height - h / 2;
  c.globalAlpha = view.alpha;
  c.drawImage(canvas, x, y, w, h);
  c.globalAlpha = 1;
}
