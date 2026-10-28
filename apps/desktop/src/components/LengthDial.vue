<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

// A timer's length as a tape under a fixed marker, like a tuning dial: drag the tape to change
// it, or click a spot on it to glide there. It always shows two hours' worth, so a long timer
// shows a later stretch of the same ruler rather than a bigger one. The arrow keys step it too.
const props = defineProps<{ max: number; label: string }>();
const minutes = defineModel<number>({ required: true });
const emit = defineEmits<{
  /** The length while it's being dragged, before it's let go, and then undefined. */
  preview: [minutes: number | undefined];
}>();

/** How many minutes the dial shows across, how far apart the stops are, and how often a label shows. */
const span = 120;
const stop = 5;
const labelEvery = 30;

const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const dial = ref<HTMLElement>();
const width = ref(0);
const perMinute = computed(() => width.value / span);
/** Where the tape is, in minutes under the marker: the length, or where a drag has got to. */
const dragged = ref<number>();
const shown = computed(() => dragged.value ?? minutes.value);

const snapped = (value: number) => Math.min(props.max, Math.max(0, Math.round(value / stop) * stop));
const labels = computed(() => Array.from({ length: props.max / labelEvery + 1 }, (_, i) => i * labelEvery));
const labelText = (at: number) => {
  if (at < 60) return String(at);
  const hours = Math.floor(at / 60);
  const rest = at % 60;
  return rest ? `${hours}h${rest}` : `${hours}h`;
};
const spoken = (at: number) => {
  const hours = Math.floor(at / 60);
  const rest = at % 60;
  if (at === 0) return 'No timer';
  return [hours && `${hours} ${hours === 1 ? 'hour' : 'hours'}`, rest && `${rest} minutes`].filter(Boolean).join(' ');
};

let grab: { id: number; x: number; from: number; moved: boolean } | undefined;
function press(event: PointerEvent) {
  if (event.button !== 0 || !dial.value) return;
  width.value = dial.value.clientWidth;
  dial.value.setPointerCapture(event.pointerId);
  grab = { id: event.pointerId, x: event.clientX, from: minutes.value, moved: false };
}
function move(event: PointerEvent) {
  if (!grab || event.pointerId !== grab.id) return;
  const by = event.clientX - grab.x;
  if (!grab.moved && Math.abs(by) < 4) return;
  grab.moved = true;
  // Dragging the tape left brings later minutes under the marker.
  dragged.value = snapped(grab.from - by / perMinute.value);
  emit('preview', dragged.value);
}
function release(event: PointerEvent) {
  if (!grab || event.pointerId !== grab.id || !dial.value) return;
  if (grab.moved) {
    if (dragged.value !== undefined) minutes.value = dragged.value;
  } else {
    // A click picks the spot that was clicked.
    const box = dial.value.getBoundingClientRect();
    minutes.value = snapped(grab.from + (event.clientX - box.left - box.width / 2) / perMinute.value);
  }
  grab = undefined;
  dragged.value = undefined;
  emit('preview', undefined);
}

function key(event: KeyboardEvent) {
  const steps: Record<string, number> = {
    ArrowLeft: -stop,
    ArrowDown: -stop,
    ArrowRight: stop,
    ArrowUp: stop,
    PageDown: -labelEvery,
    PageUp: labelEvery,
  };
  let next: number | undefined;
  if (event.key in steps) next = snapped(minutes.value + steps[event.key]!);
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = props.max;
  if (next === undefined) return;
  event.preventDefault();
  minutes.value = next;
}

const observer = new ResizeObserver(([entry]) => (width.value = entry?.contentRect.width ?? 0));
onMounted(() => dial.value && observer.observe(dial.value));
onUnmounted(() => observer.disconnect());
</script>

<template>
  <div
    ref="dial"
    class="dial"
    role="slider"
    tabindex="0"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="minutes"
    :aria-valuetext="spoken(minutes)"
    :class="{ dragging: dragged !== undefined, still: still.matches }"
    @pointerdown="press"
    @pointermove="move"
    @pointerup="release"
    @pointercancel="release"
    @keydown="key"
  >
    <div
      class="tape"
      :style="{
        width: `${max * perMinute}px`,
        translate: `${width / 2 - shown * perMinute}px 0`,
        '--stop': `${stop * perMinute}px`,
        '--label': `${labelEvery * perMinute}px`,
      }"
    >
      <span
        v-for="at in labels"
        :key="at"
        class="label mono"
        :class="{ near: Math.abs(at - shown) < labelEvery / 2 }"
        :style="{ left: `${at * perMinute}px` }"
        >{{ labelText(at) }}</span
      >
    </div>
    <span class="marker" aria-hidden="true" />
  </div>
</template>

<style scoped>
.dial {
  position: relative;
  height: 34px;
  overflow: hidden;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  /* The tape fades out toward the edges. */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
}

.dial.dragging {
  cursor: grabbing;
}

.dial:focus-visible {
  outline: none;
}

.dial:focus-visible .marker {
  box-shadow:
    0 0 8px var(--c, var(--glow)),
    0 0 0 3px rgb(207 224 255 / 0.25);
}

/* A short tick every 5 minutes and a long one at every label, with the label above it. */
.tape {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  /* Room past the last tick for its line. */
  padding-right: 1px;
  background:
    repeating-linear-gradient(90deg, rgb(220 228 255 / 0.45) 0 1px, transparent 1px var(--label)) bottom / 100% 12px
      no-repeat,
    repeating-linear-gradient(90deg, rgb(220 228 255 / 0.22) 0 1px, transparent 1px var(--stop)) bottom / 100% 6px
      no-repeat;
  transition: translate 450ms var(--ease);
}

.dragging .tape,
.still .tape {
  transition: none;
}

.label {
  position: absolute;
  top: 2px;
  translate: -50% 0;
  transition: color 300ms;
}

.label.near {
  color: var(--dim);
}

/* The fixed marker in the middle, in the profile's color. */
.marker {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 1px;
  height: 18px;
  background: var(--c, var(--glow));
  box-shadow: 0 0 8px var(--c, var(--glow));
}
</style>
