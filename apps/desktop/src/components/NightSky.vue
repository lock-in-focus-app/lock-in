<script setup lang="ts">
import { skyPlaces } from '@lock-in/core';
import { onMounted, onUnmounted, ref, watch } from 'vue';

// The night sky behind the window (PLAN §5): one canvas, drawn by code. The constellations come
// from the reward engine (packages/core/src/constellations.ts); this only draws them, with light
// pollution washing them out as `clarity` falls. It redraws about 20 times a second while stars
// twinkle or the haze is moving, every frame while something moves, and only when something
// changes under reduced motion.
//
// It has two layouts, and constellations glide from one to the other. On the Sky (`sky`), they
// gather close together, the newest in the middle, like one starry collection. Exploring spreads
// them out, and hovering one there brightens it and shows its name beneath it. In the weekly report (`week`), they line up in week
// order, with the week being looked at large and soft behind the page's header.
//
// With `drift` on (exploring the Sky page), the sky leans and zooms gently toward the pointer, like
// nudging a telescope, with brighter (nearer) stars moving a little more for depth.

export interface SkyStar {
  id: string;
  /** Where it sits in its constellation: from -1 to 1 across, and -0.5 to 0.5 down. */
  x: number;
  y: number;
  color: string;
  /** Size and brightness, from 0 to 1. */
  magnitude: number;
  /** Extra twinkle from overtime, from 0 to 1. */
  sparkle: number;
}

export interface SkyConstellation {
  id: string;
  name: string;
  /** When its week starts (epoch ms). */
  weekStart: number;
  stars: SkyStar[];
  /** Lines joining its stars, as pairs of indexes into `stars`. */
  lines: [number, number][];
}

const props = defineProps<{
  /** Oldest first. */
  constellations: SkyConstellation[];
  /** How clear the sky should be, from 0 (hazy) to 1 (clear). The haze drifts there slowly. */
  clarity: number;
  /** Whether the sky drifts toward the pointer. */
  drift?: boolean;
  /** Whether hovering a constellation brightens it and shows its name beneath it. */
  names?: boolean;
  /** In the week layout, the start of the week being looked at (epoch ms). Otherwise the Sky layout. */
  week?: number;
}>();

const canvas = ref<HTMLCanvasElement>();
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
/** How long the haze takes to drift most of the way to a new clarity. */
const hazeDriftMs = 2500;
const frameMs = 50;
/** How far the view pans toward the pointer, as a share of the sky, and how much it zooms in. */
const driftPan = 0.04;
const driftZoom = 0.06;
/** How long the view takes to catch up with the pointer. */
const driftMs = 900;
/** How long constellations take to glide most of the way to a new layout, and to brighten. */
const glideMs = 1200;
const shineMs = 350;
const weekMs = 7 * 24 * 60 * 60_000;
/** How far a constellation reaches from its middle, in its own units: across, then up and down with its name. */
const reach = { x: 1.15, up: 0.6, down: 1 };
/** How much closer together constellations sit on the Sky than while exploring. They overlap a little. */
const skyGather = 0.5;

let context: CanvasRenderingContext2D | null = null;
let frame = 0;
let lastDrawn = 0;
let lastTime = 0;
let shownClarity = props.clarity;
let font = 'system-ui, sans-serif';
// Where the pointer is (from -1 to 1 across and down) and how far in to zoom (0 to 1), and
// where the view has got to on its way there.
let aim = { x: 0, y: 0, zoom: 0 };
const lens = { x: 0, y: 0, zoom: 0 };
const sprites = new Map<string, HTMLCanvasElement>();

/**
 * Where a constellation is: its middle (as shares of the sky's width and height), how big one of
 * its units is (as a share of the width), how bright it is overall, and how visible its name is.
 */
interface Place {
  x: number;
  y: number;
  unit: number;
  alpha: number;
  label: number;
  /** How much it stands out, as if hovered, from 0 to 1: the week the report is showing. */
  lift: number;
}
/** Where each constellation has got to on its way to where the layout puts it. */
const shown = new Map<string, Place>();
/** How brightly each constellation shines from being hovered, from 0 to 1. */
const shine = new Map<string, number>();
let hovered: string | undefined;
/** Where each constellation was last drawn, in canvas pixels, to find the one under the pointer. */
let drawnBoxes: { id: string; left: number; right: number; top: number; bottom: number }[] = [];

/** A soft glow with a bright core in `color`, drawn once and stamped for every star of that color. */
function sprite(color: string): HTMLCanvasElement {
  let glow = sprites.get(color);
  if (glow) return glow;
  glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  const g = glow.getContext('2d')!;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.08, color);
  gradient.addColorStop(0.22, `${color}66`);
  gradient.addColorStop(0.5, `${color}14`);
  gradient.addColorStop(1, `${color}00`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, glow);
  return glow;
}

/** Where the layout puts each constellation, for a sky `width` by `height`. */
function targets(width: number, height: number): Map<string, Place> {
  const places = new Map<string, Place>();
  const list = props.constellations;
  if (props.week !== undefined) {
    // In week order, the week being looked at behind the header and the rest off to its sides.
    for (const constellation of list) {
      const weeks = Math.round((constellation.weekStart - props.week) / weekMs);
      places.set(constellation.id, {
        x: 0.5 + weeks * 0.86,
        y: Math.min(0.16, 96 / height),
        unit: 0.34,
        alpha: weeks === 0 ? 1 : 0.4,
        label: 0,
        lift: weeks === 0 ? 1 : 0,
      });
    }
    return places;
  }
  // Packed close, so the Sky reads as one starry collection, fitted between the header and the
  // cards at the bottom. Exploring clears the cards away, and they spread out into separate
  // constellations to admire one at a time.
  const gather = props.drift ? 1 : skyGather;
  const spots = skyPlaces(list.length).map((s) => ({ x: s.x * gather, y: s.y * gather }));
  const xs = spots.map((s) => s.x);
  const ys = spots.map((s) => s.y);
  const box = {
    left: Math.min(...xs) - reach.x,
    right: Math.max(...xs) + reach.x,
    top: Math.min(...ys) - reach.up,
    bottom: Math.max(...ys) + reach.down,
  };
  const area = {
    left: 0.06 * width,
    right: 0.94 * width,
    top: 0.13 * height,
    bottom: (props.drift ? 0.9 : 0.58) * height,
  };
  const fitX = (area.right - area.left) / (box.right - box.left);
  const fitY = (area.bottom - area.top) / (box.bottom - box.top);
  const unit = Math.min(fitX, fitY, (props.drift ? 0.26 : 0.34) * width);
  // While exploring, the middles may spread a little further apart than the constellations
  // grow, to fill the sky.
  const spreadX = props.drift ? Math.min(fitX, unit * 1.4) : unit;
  const spreadY = props.drift ? Math.min(fitY, unit * 1.6) : unit;
  const middle = { x: (area.left + area.right) / 2, y: (area.top + area.bottom) / 2 };
  const boxMiddle = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  list.forEach((constellation, i) => {
    places.set(constellation.id, {
      x: (middle.x + (spots[i]!.x - boxMiddle.x) * spreadX) / width,
      y: (middle.y + (spots[i]!.y - boxMiddle.y) * spreadY) / height,
      unit: unit / width,
      alpha: 1,
      label: props.names ? 1 : 0,
      lift: 0,
    });
  });
  return places;
}

/** Moves each constellation a step toward where the layout puts it. Returns whether any are still on their way. */
function glide(elapsed: number, width: number, height: number): boolean {
  const follow = still.matches ? 1 : 1 - Math.exp(-elapsed / (glideMs / 3));
  let moving = false;
  for (const [id, target] of targets(width, height)) {
    const place = shown.get(id);
    if (!place) {
      shown.set(id, { ...target });
      continue;
    }
    for (const key of ['x', 'y', 'unit', 'alpha', 'label', 'lift'] as const) {
      const gap = target[key] - place[key];
      if (Math.abs(gap) < 0.0005) place[key] = target[key];
      else {
        place[key] += gap * follow;
        moving = true;
      }
    }
  }
  // Forget constellations that are gone, e.g. with the sample data.
  if (shown.size > props.constellations.length) {
    const ids = new Set(props.constellations.map((c) => c.id));
    for (const id of shown.keys()) if (!ids.has(id)) shown.delete(id);
  }
  const brighten = still.matches ? 1 : 1 - Math.exp(-elapsed / (shineMs / 3));
  for (const constellation of props.constellations) {
    const level = shine.get(constellation.id) ?? 0;
    const target = constellation.id === hovered ? 1 : 0;
    if (Math.abs(target - level) < 0.005) shine.set(constellation.id, target);
    else {
      shine.set(constellation.id, level + (target - level) * brighten);
      moving = true;
    }
  }
  return moving;
}

function resize() {
  const sky = canvas.value;
  if (!sky) return;
  const scale = window.devicePixelRatio || 1;
  sky.width = Math.round(sky.clientWidth * scale);
  sky.height = Math.round(sky.clientHeight * scale);
  draw(performance.now());
}

/** Where a point (as shares of the sky) ends up with the telescope drift, as shares too. */
function drifted(x: number, y: number, depth: number) {
  const zoom = 1 + driftZoom * lens.zoom * depth;
  const centerX = 0.5 + lens.x / 2;
  const centerY = 0.5 + lens.y / 2;
  return {
    x: centerX + (x - centerX) * zoom - lens.x * driftPan * depth,
    y: centerY + (y - centerY) * zoom - lens.y * driftPan * depth,
    zoom,
  };
}

function draw(time: number) {
  const sky = canvas.value;
  if (!sky || !context) return;
  const { width, height } = sky;
  const scale = window.devicePixelRatio || 1;
  const haze = 1 - shownClarity;
  const c = context;

  const night = c.createLinearGradient(0, 0, 0, height);
  night.addColorStop(0, '#060914');
  night.addColorStop(1, '#0f1530');
  c.globalAlpha = 1;
  c.fillStyle = night;
  c.fillRect(0, 0, width, height);

  const boxes: typeof drawnBoxes = [];
  c.font = `${12 * scale}px ${font}`;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.lineWidth = scale;
  c.strokeStyle = 'rgb(205 215 255)';
  for (const constellation of props.constellations) {
    const place = shown.get(constellation.id);
    if (!place || place.alpha <= 0.01) continue;
    const unit = place.unit * width;
    const middleX = place.x * width;
    const middleY = place.y * height;
    if (middleX + reach.x * unit < -width * 0.2 || middleX - reach.x * unit > width * 1.2) continue;
    const glow = Math.max(shine.get(constellation.id) ?? 0, place.lift);
    // The week the report shows cuts through the haze a little, so it reads behind the header.
    const dimmed = haze * (1 - 0.5 * place.lift);
    const positions = constellation.stars.map((star) => {
      const depth = 0.5 + star.magnitude;
      const at = drifted((middleX + star.x * unit) / width, (middleY + star.y * unit) / height, depth);
      return { x: at.x * width, y: at.y * height, zoom: at.zoom };
    });

    // Faint lines first, so the stars sit on top of them.
    c.globalAlpha = (0.14 + 0.26 * glow) * place.alpha * (1 - 0.6 * dimmed);
    c.beginPath();
    for (const [from, to] of constellation.lines) {
      const a = positions[from];
      const b = positions[to];
      if (!a || !b) continue;
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
    }
    c.stroke();

    constellation.stars.forEach((star, i) => {
      const at = positions[i]!;
      const size = (10 + star.magnitude * 26) * scale * (1 + (at.zoom - 1) / 2) * (1 + 0.2 * glow);
      let alpha = (0.35 + 0.65 * star.magnitude) * (1 - 0.7 * dimmed) * (0.85 + 0.15 * glow);
      if (!still.matches) {
        // Each star twinkles at its own pace, from where it sits.
        const wave = Math.sin((time / 1000) * (0.5 + (star.y + 0.5) * 0.9) + star.x * 100);
        alpha *= 0.82 + 0.18 * wave + star.sparkle * 0.25 * Math.max(0, wave);
      }
      c.globalAlpha = Math.min(1, Math.max(0, alpha * place.alpha));
      c.drawImage(sprite(star.color), at.x - size / 2, at.y - size / 2, size, size);
    });

    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const box = {
      id: constellation.id,
      left: Math.min(...xs) - 12 * scale,
      right: Math.max(...xs) + 12 * scale,
      top: Math.min(...ys) - 12 * scale,
      bottom: Math.max(...ys) + 28 * scale,
    };
    boxes.push(box);
    if (place.label * glow > 0.01) {
      // Its name, beneath it while it's hovered.
      c.globalAlpha = place.label * glow * 0.95 * (1 - 0.4 * haze);
      c.fillStyle = '#f3f0e6';
      // Kept inside the window, so a name near the edge isn't cut off.
      const half = c.measureText(constellation.name).width / 2 + 6 * scale;
      const x = Math.min(width - half, Math.max(half, (box.left + box.right) / 2));
      c.fillText(constellation.name, x, Math.max(...ys) + 12 * scale);
    }
  }
  drawnBoxes = boxes;

  if (haze > 0.01) {
    // Light pollution: a pale wash, thickest near the horizon, with the town's warm glow under it.
    c.globalAlpha = haze;
    const wash = c.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, 'rgb(46 54 92 / 0.18)');
    wash.addColorStop(0.6, 'rgb(84 88 128 / 0.3)');
    wash.addColorStop(1, 'rgb(150 130 150 / 0.42)');
    c.fillStyle = wash;
    c.fillRect(0, 0, width, height);
    const town = c.createRadialGradient(width / 2, height * 1.25, 0, width / 2, height * 1.25, height * 0.9);
    town.addColorStop(0, 'rgb(230 170 120 / 0.28)');
    town.addColorStop(1, 'rgb(230 170 120 / 0)');
    c.fillStyle = town;
    c.fillRect(0, 0, width, height);
  }
  lastDrawn = time;
}

function tick(time: number) {
  const elapsed = lastTime ? time - lastTime : 0;
  lastTime = time;
  const hazing = Math.abs(props.clarity - shownClarity) > 0.002;
  if (hazing) {
    shownClarity += (props.clarity - shownClarity) * (1 - Math.exp(-elapsed / (hazeDriftMs / 3)));
  } else {
    shownClarity = props.clarity;
  }
  const follow = 1 - Math.exp(-elapsed / (driftMs / 3));
  const panning = Math.abs(aim.x - lens.x) + Math.abs(aim.y - lens.y) + Math.abs(aim.zoom - lens.zoom) > 0.001;
  if (panning) {
    lens.x += (aim.x - lens.x) * follow;
    lens.y += (aim.y - lens.y) * follow;
    lens.zoom += (aim.zoom - lens.zoom) * follow;
  }
  const sky = canvas.value;
  const gliding = sky ? glide(elapsed, sky.width, sky.height) : false;
  // Under reduced motion nothing twinkles, so the loop stops once everything has settled.
  const moving = !still.matches || hazing;
  if (!moving || panning || gliding || time - lastDrawn >= frameMs) draw(time);
  frame = moving || panning || gliding ? requestAnimationFrame(tick) : 0;
}

function wake() {
  if (still.matches) shownClarity = props.clarity;
  if (!frame) {
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }
}

function point(event: PointerEvent) {
  hover(event);
  if (!props.drift || still.matches || event.pointerType !== 'mouse') return;
  aim = { x: (event.clientX / window.innerWidth) * 2 - 1, y: (event.clientY / window.innerHeight) * 2 - 1, zoom: 1 };
  wake();
}

/** Brightens the constellation under the pointer, unless the pointer is on a card or button. */
function hover(event: PointerEvent) {
  let found: string | undefined;
  const target = event.target instanceof Element ? event.target : null;
  const onPage = target?.closest('button, a, input, textarea, select, nav, .card');
  if (props.names && props.week === undefined && !onPage) {
    const scale = window.devicePixelRatio || 1;
    const x = event.clientX * scale;
    const y = event.clientY * scale;
    found = drawnBoxes.find((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)?.id;
  }
  if (found !== hovered) {
    hovered = found;
    wake();
  }
}

function settle() {
  aim = { x: 0, y: 0, zoom: 0 };
  hovered = undefined;
  wake();
}

watch(() => [props.constellations, props.clarity, props.names, props.week, props.drift], wake);
watch(
  () => props.drift,
  (drift) => !drift && settle(),
);
watch(
  () => props.names,
  (names) => !names && (hovered = undefined),
);
const observer = new ResizeObserver(resize);

onMounted(() => {
  context = canvas.value!.getContext('2d');
  font = getComputedStyle(document.body).fontFamily || font;
  observer.observe(canvas.value!);
  still.addEventListener('change', wake);
  window.addEventListener('pointermove', point);
  document.documentElement.addEventListener('pointerleave', settle);
  wake();
});

onUnmounted(() => {
  cancelAnimationFrame(frame);
  observer.disconnect();
  still.removeEventListener('change', wake);
  window.removeEventListener('pointermove', point);
  document.documentElement.removeEventListener('pointerleave', settle);
});
</script>

<template>
  <canvas ref="canvas" class="sky" aria-hidden="true" />
</template>

<style scoped>
.sky {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
