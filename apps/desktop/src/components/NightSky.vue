<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

// The night sky behind the window (PLAN §5): one canvas, drawn by code. The stars come from
// the reward engine (packages/core/src/sky.ts); this only draws them, with light pollution
// washing them out as `clarity` falls. It redraws about 20 times a second while stars twinkle
// or the haze is moving, and only when something changes under reduced motion.

export interface SkyStar {
  id: string;
  /** From 0 to 1 across and down the sky. */
  x: number;
  y: number;
  color: string;
  /** Size and brightness, from 0 to 1. */
  magnitude: number;
  /** Extra twinkle from overtime, from 0 to 1. */
  sparkle: number;
}

const props = defineProps<{
  stars: SkyStar[];
  /** How clear the sky should be, from 0 (hazy) to 1 (clear). The haze drifts there slowly. */
  clarity: number;
}>();

const canvas = ref<HTMLCanvasElement>();
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
/** How long the haze takes to drift most of the way to a new clarity. */
const hazeDriftMs = 2500;
const frameMs = 50;

let context: CanvasRenderingContext2D | null = null;
let frame = 0;
let lastDrawn = 0;
let lastTime = 0;
let shownClarity = props.clarity;
const sprites = new Map<string, HTMLCanvasElement>();

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

function resize() {
  const sky = canvas.value;
  if (!sky) return;
  const scale = window.devicePixelRatio || 1;
  sky.width = Math.round(sky.clientWidth * scale);
  sky.height = Math.round(sky.clientHeight * scale);
  draw(performance.now());
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

  for (const star of props.stars) {
    const size = (10 + star.magnitude * 26) * scale;
    let alpha = (0.35 + 0.65 * star.magnitude) * (1 - 0.7 * haze);
    if (!still.matches) {
      // Each star twinkles at its own pace, from where it sits.
      const wave = Math.sin((time / 1000) * (0.5 + star.y * 0.9) + star.x * 100);
      alpha *= 0.82 + 0.18 * wave + star.sparkle * 0.25 * Math.max(0, wave);
    }
    c.globalAlpha = Math.min(1, Math.max(0, alpha));
    c.drawImage(sprite(star.color), star.x * width - size / 2, star.y * height - size / 2, size, size);
  }

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
  const drifting = Math.abs(props.clarity - shownClarity) > 0.002;
  if (drifting) {
    shownClarity += (props.clarity - shownClarity) * (1 - Math.exp(-elapsed / (hazeDriftMs / 3)));
  } else {
    shownClarity = props.clarity;
  }
  // Under reduced motion nothing twinkles, so the loop stops once the haze has settled.
  const moving = !still.matches || drifting;
  if (!moving || time - lastDrawn >= frameMs) draw(time);
  frame = moving ? requestAnimationFrame(tick) : 0;
}

function wake() {
  if (still.matches) shownClarity = props.clarity;
  if (!frame) {
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }
}

watch(() => [props.stars, props.clarity], wake);
const observer = new ResizeObserver(resize);

onMounted(() => {
  context = canvas.value!.getContext('2d');
  observer.observe(canvas.value!);
  still.addEventListener('change', wake);
  wake();
});

onUnmounted(() => {
  cancelAnimationFrame(frame);
  observer.disconnect();
  still.removeEventListener('change', wake);
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
