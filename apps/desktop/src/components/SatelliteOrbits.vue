<script setup lang="ts">
import { seeded } from '@lock-in/core';
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

// Tiny satellites in lazy orbits around a frame (PLAN §4): one for each thought in orbit, on a
// flat, tilted ellipse that passes behind the frame across the top and in front across the
// bottom. The layer is placed over the frame by whoever uses it (with `inset`), and the orbits
// reach a little past its edges. Its `--behind` and `--in-front` are the z-indexes either side
// of the frame. One that's launched while it's shown joins the others with a glint.

type Range = [min: number, max: number];

const props = defineProps<{
  /** The satellites in orbit, oldest first, or undefined until they're known. */
  ids: string[] | undefined;
  /** How far past the frame's sides (x) and top and bottom (y) the orbits reach, in px, how far
   * they tilt, in degrees, and how long a turn takes, in seconds. */
  shape: { x: Range; y: Range; tilt: Range; period: Range };
  max: number;
}>();

interface Orbit {
  id: string;
  joining: boolean;
  style: Record<string, string>;
}

/**
 * A satellite's orbit, the same each time for the same satellite, and where it would be had it
 * gone on circling while it wasn't shown. One that's joining starts in front instead, just left
 * of the middle.
 */
function orbitFor(id: string, joining: boolean): Orbit {
  const random = seeded(id);
  const between = ([min, max]: Range) => min + (max - min) * random();
  const periodS = between(props.shape.period);
  const turn = joining ? 0.8 : (Date.now() / 1000 / periodS + random()) % 1;
  return {
    id,
    joining,
    style: {
      '--a': `calc(var(--half-width) + ${between(props.shape.x)}px)`,
      '--b': `calc(var(--half-height) + ${between(props.shape.y)}px)`,
      '--tilt': `${between(props.shape.tilt)}deg`,
      '--angle': `${-30 + 60 * random()}deg`,
      '--half': `${periodS / 2}s`,
      // Across and up-and-down are a quarter of a turn apart, which makes the ellipse.
      '--x-delay': `${-turn * periodS}s`,
      '--y-delay': `${-(turn + 0.75) * periodS}s`,
    },
  };
}

// Each satellite keeps its orbit while it's shown. The first ones known were already in orbit;
// any after that have just been launched (or sent back into orbit).
const orbits = ref<Orbit[]>([]);
watch(
  () => props.ids,
  (ids, before) => {
    if (!ids) return;
    const kept = new Map(orbits.value.map((orbit) => [orbit.id, orbit]));
    orbits.value = ids.slice(-props.max).map((id) => kept.get(id) ?? orbitFor(id, !!before));
  },
  { immediate: true },
);

// The orbits are sized from the frame, which grows and shrinks with what's in it.
const layer = useTemplateRef('layer');
const size = ref<Record<string, string>>({});
const observer = new ResizeObserver(([entry]) => {
  if (!entry) return;
  const { width, height } = entry.contentRect;
  size.value = { '--half-width': `${width / 2}px`, '--half-height': `${height / 2}px` };
});
onMounted(() => layer.value && observer.observe(layer.value));
onUnmounted(() => observer.disconnect());
</script>

<template>
  <div ref="layer" class="orbits" :style="size" aria-hidden="true">
    <TransitionGroup name="orbit">
      <span
        v-for="orbit in orbits"
        :key="orbit.id"
        class="orbit"
        :class="{ joining: orbit.joining }"
        :style="orbit.style"
      >
        <span class="satellite" />
      </span>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.orbits {
  --sine: cubic-bezier(0.37, 0, 0.63, 1);
  position: absolute;
  pointer-events: none;
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
  z-index: var(--behind, 0);
  transform: skewY(var(--tilt));
  animation:
    orbit-y var(--half) var(--sine) var(--y-delay) infinite alternate,
    orbit-z var(--half) steps(2, jump-none) var(--y-delay) infinite alternate;
}

/* One that leaves orbit fades away. */
.orbit-leave-active {
  transition: opacity 900ms ease;
}

.orbit-leave-to {
  opacity: 0;
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
    z-index: var(--in-front, 2);
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

/* Reduced motion: the satellites stay still where they are, and only fade in. */
@media (prefers-reduced-motion: reduce) {
  .orbit {
    animation-play-state: paused;
  }

  .satellite,
  .joining .satellite {
    animation-name: orbit-x, appear;
    animation-play-state: paused, running;
  }
}
</style>
