<script setup lang="ts">
import type { Satellite, Snapshot } from '@lock-in/core';
import { glowFor, lifetimeFocusMs } from '@lock-in/core';
import { invoke } from '@tauri-apps/api/core';
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { applyGlow, closeCapture, launchSatellite, maxSatelliteLength, sessionLog } from './app';

// The satellite box Alt+P opens: type the thought, press Return, and you're straight back
// where you were. It's a frame like the app's (PLAN Phase 5) in a see-through window, so it can
// drift in over whatever's open, lift off with the thought, and fade when closed. The thoughts
// already in orbit circle it as tiny satellites, and a launched one joins them.

const text = ref('');
const sessionRunning = ref(true);
const shown = ref(false);
const launched = ref(false);
const leaving = ref(false);
const error = ref('');
const input = useTemplateRef('input');
const frame = useTemplateRef('frame');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));

interface Orbit {
  id: string;
  joining?: boolean;
  style: Record<string, string>;
}

// Plenty for a busy session, without crowding the box.
const maxOrbits = 24;
const orbits = ref<Orbit[]>([]);

/** Random numbers from 0 to 1 that are the same each time for the same seed (mulberry32). */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A satellite's orbit: a flat ellipse around the box, a little tilted, that passes behind it
 * across the top and in front across the bottom. Each satellite keeps its own orbit, and it's
 * where it would be had it gone on circling while the box was closed. `at` puts it at a given
 * place instead, as a share of the way round (0.8 is in front, just left of the middle).
 */
function orbitFor(id: string, at?: number): Orbit {
  const random = seeded(id);
  const periodS = 28 + 24 * random();
  const turn = at ?? (Date.now() / 1000 / periodS + random()) % 1;
  return {
    id,
    style: {
      '--a': `${330 + 32 * random()}px`,
      '--b': `${42 + 14 * random()}px`,
      '--tilt': `${-6 + 10 * random()}deg`,
      '--angle': `${-30 + 60 * random()}deg`,
      '--half': `${periodS / 2}s`,
      // Across and up-and-down are a quarter of a turn apart, which makes the ellipse.
      '--x-delay': `${-turn * periodS}s`,
      '--y-delay': `${-(turn + 0.75) * periodS}s`,
    },
  };
}

const showOrbits = (satellites: Satellite[]) =>
  (orbits.value = satellites
    .filter((satellite) => satellite.state === 'orbiting')
    .slice(-maxOrbits)
    .map((satellite) => orbitFor(satellite.id)));

// Clicking around the box closes it, as clicking another app does.
function closeOnClickAway(event: PointerEvent) {
  if (!frame.value?.contains(event.target as Node)) void close();
}
onUnmounted(() => document.removeEventListener('pointerdown', closeOnClickAway));

onMounted(() => {
  input.value?.focus();
  // Its starting place is worked out first, so it drifts in from there.
  void frame.value?.offsetHeight;
  shown.value = true;
  document.addEventListener('pointerdown', closeOnClickAway);
  void invoke<Snapshot>('snapshot').then(async (snapshot) => {
    sessionRunning.value = !!snapshot.session;
    showOrbits(snapshot.satellites);
    // In the glow color picked in Settings, as in the app.
    applyGlow(glowFor(snapshot.settings.glow, lifetimeFocusMs(await sessionLog())));
  });
});

async function launch() {
  if (launched.value || leaving.value) return;
  error.value = '';
  try {
    if (await launchSatellite(text.value)) {
      // A moment to see it lift off, with the frame drifting up after it, and to see it join
      // the others in orbit, which fade a little after the frame. The window only closes once
      // they're gone.
      orbits.value = [...orbits.value.slice(1 - maxOrbits), { ...orbitFor(`${Date.now()}`, 0.8), joining: true }];
      launched.value = true;
      await wait(820);
    } else {
      // Nothing to launch, so it just closes.
      leaving.value = true;
      await wait(180);
    }
    await closeCapture();
  } catch (reason) {
    launched.value = false;
    error.value = `Couldn't launch it: ${String(reason)}`;
  }
}

async function close() {
  if (launched.value || leaving.value) return;
  leaving.value = true;
  await wait(180);
  await closeCapture();
}
</script>

<template>
  <div class="orbits" :class="{ launched, leaving }" aria-hidden="true">
    <span
      v-for="orbit in orbits"
      :key="orbit.id"
      class="orbit"
      :class="{ joining: orbit.joining }"
      :style="orbit.style"
    >
      <span class="satellite" />
    </span>
  </div>
  <form
    ref="frame"
    class="card capture"
    :class="{ shown, launched, leaving }"
    @submit.prevent="launch"
    @keydown.esc.prevent="close"
  >
    <div class="line">
      <span class="prompt" aria-hidden="true">›</span>
      <input
        ref="input"
        v-model="text"
        :maxlength="maxSatelliteLength"
        :placeholder="sessionRunning ? 'Park it until this session ends' : 'Park a thought for later'"
        aria-label="Satellite"
        autocomplete="off"
        spellcheck="true"
      />
    </div>
    <p class="hint mono">
      <span v-if="error" class="error" role="alert">{{ error }}</span>
      <span v-else class="what"
        ><span class="dot" aria-hidden="true" />Satellites · back after
        {{ sessionRunning ? 'this' : 'your next' }} session</span
      >
      <span class="keys"><span class="key">↵ Launch</span><span class="key">Esc Close</span></span>
    </p>
  </form>
</template>

<style>
/* The window is see-through around the frame. */
html,
html body {
  height: 100%;
  background: transparent;
  overflow: hidden;
}
</style>

<style scoped>
/* Room around the frame for its shadow and the satellites' orbits (the window's size is in
   capture.rs). Above the satellites passing behind it, and below those passing in front. */
.capture {
  position: absolute;
  inset: 45px 60px;
  z-index: 1;
  display: grid;
  gap: 8px;
  align-content: center;
  padding: 12px 16px 10px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 0.5);
  /* It drifts up into place and comes into focus. */
  opacity: 0;
  translate: 0 8px;
  scale: 0.985;
  filter: blur(4px);
  transition:
    opacity 360ms ease,
    translate 520ms var(--ease),
    scale 520ms var(--ease),
    filter 360ms ease;
}

/* Over whatever's open, so the tint is darker than the app's frames over its sky. */
.capture::before {
  background-color: rgb(11 15 30 / 0.94);
}

.capture:focus-within {
  --t: var(--tick-bright);
}

.capture.shown {
  opacity: 1;
  translate: 0 0;
  scale: 1;
  filter: none;
}

/* Closed: it fades back down. */
.capture.leaving {
  opacity: 0;
  translate: 0 4px;
  transition-duration: 180ms;
}

/* Launched: the thought lifts off, and the frame drifts up after it, fading out of focus. */
.capture.launched {
  opacity: 0;
  translate: 0 -6px;
  scale: 0.99;
  filter: blur(3px);
  transition:
    opacity 420ms ease-in-out 120ms,
    translate 460ms var(--ease) 120ms,
    scale 460ms var(--ease) 120ms,
    filter 420ms ease 120ms;
}

.line {
  display: flex;
  align-items: center;
  gap: 10px;
  transition:
    translate 420ms var(--ease),
    opacity 300ms ease;
}

.launched .line {
  translate: 0 -14px;
  opacity: 0;
}

.prompt {
  color: var(--dim);
  font: 15px var(--mono);
}

input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: none;
  color: var(--starlight);
  font: 15px var(--mono);
  text-overflow: ellipsis;
  caret-color: #9fe3c9;
}

input::placeholder {
  color: var(--faint);
}

.hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.what {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.what .dot {
  animation: breathe 4s ease-in-out infinite;
}

@keyframes breathe {
  50% {
    opacity: 0.4;
  }
}

.keys {
  display: flex;
  gap: 6px;
}

.error {
  color: #f0a3a3;
  text-transform: none;
}

/*
 * A satellite on its orbit: the outer part moves up and down and the inner one across, a quarter
 * of a turn apart, with an ease like a sine wave, which traces an ellipse. Skewing the outer part
 * tilts it. It passes in front of the frame on the lower half and behind it on the upper half.
 */
.orbit {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 0;
  transform: skewY(var(--tilt));
  animation:
    orbit-y var(--half) var(--sine) var(--y-delay) infinite alternate,
    orbit-z var(--half) steps(2, jump-none) var(--y-delay) infinite alternate;
  transition: opacity 180ms ease;
}

.orbits {
  --sine: cubic-bezier(0.37, 0, 0.63, 1);
}

/* Closed, they fade with the frame. Launched, they stay a moment longer, with the new one. */
.leaving .orbit {
  opacity: 0;
}

.launched .orbit {
  opacity: 0;
  transition: opacity 420ms ease-in-out 380ms;
}

@keyframes orbit-y {
  from {
    translate: 0 calc(-1 * var(--b));
  }
  to {
    translate: 0 var(--b);
  }
}

@keyframes orbit-z {
  to {
    z-index: 2;
  }
}

/* A tiny satellite like the Sky's (satellite.ts): gold foil between two blue solar panels, with
   a faint glow. */
.satellite {
  position: absolute;
  left: -2px;
  top: -1.75px;
  width: 4px;
  height: 3.5px;
  background: linear-gradient(#f6ead0, #bfa874);
  box-shadow: 0 0 7px 2px rgb(225 230 255 / 0.22);
  rotate: var(--angle);
  animation:
    orbit-x var(--half) var(--sine) var(--x-delay) infinite alternate,
    appear 900ms ease 160ms both;
}

.satellite::before,
.satellite::after {
  content: '';
  position: absolute;
  top: 0;
  width: 7px;
  height: 3.5px;
  background: linear-gradient(135deg, #3d5aa0, #7d9ee0);
}

.satellite::before {
  right: calc(100% + 1.5px);
}

.satellite::after {
  left: calc(100% + 1.5px);
}

/* The thought just launched arrives with a glint. */
.joining .satellite {
  animation:
    orbit-x var(--half) var(--sine) var(--x-delay) infinite alternate,
    join 700ms var(--ease) both;
}

@keyframes orbit-x {
  from {
    translate: calc(-1 * var(--a)) 0;
  }
  to {
    translate: var(--a) 0;
  }
}

@keyframes appear {
  from {
    opacity: 0;
  }
}

@keyframes join {
  from {
    opacity: 0;
    scale: 2.5;
    box-shadow: 0 0 12px 5px rgb(225 230 255 / 0.6);
  }
}

/* Reduced motion: it only fades, and the satellites stay still where they are. */
@media (prefers-reduced-motion: reduce) {
  .capture {
    translate: none;
    scale: none;
    filter: none;
    transition: opacity 200ms ease;
  }

  .line {
    transition: opacity 200ms;
  }

  .capture.leaving,
  .capture.launched,
  .launched .line {
    translate: none;
    scale: none;
    filter: none;
  }

  .orbit {
    animation-play-state: paused;
  }

  .satellite,
  .joining .satellite {
    animation-name: orbit-x, appear;
    animation-play-state: paused, running;
  }

  .what .dot {
    animation: none;
  }
}
</style>
