<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

// The tour for new users (PLAN Phase 5): a small panel that steps through the settings page, with
// the part each step is about outlined. It only runs when asked for (the popup offers it once, and
// this page has it after that), and every step can skip the rest.

export interface TourStep {
  /** The `data-tour` name of the part of the page the step is about, if it's on this page. */
  target?: string;
  title: string;
  text: string;
}

const props = defineProps<{ steps: TourStep[] }>();
const step = defineModel<number>('step', { required: true });
const emit = defineEmits<{ end: [] }>();

const current = computed(() => props.steps[step.value]!);
const last = computed(() => step.value === props.steps.length - 1);

// Where the part being described is in the window. It's measured again for a moment after each
// step, while the page settles, and whenever the window or the part changes size, or the page
// scrolls.
const spot = ref<DOMRect>();
const windowHeight = ref(innerHeight);
const panel = useTemplateRef('panel');
const panelHeight = ref(0);
let target: Element | null = null;
const resized = new ResizeObserver(() => measure());
function measure() {
  const found = current.value.target ? document.querySelector(`[data-tour="${current.value.target}"]`) : null;
  let rect = found?.getBoundingClientRect();
  if (found !== target) {
    if (target) resized.unobserve(target);
    if (found) resized.observe(found);
    target = found;
    // One out of sight, further down the page, is brought up near the top, with the panel below it.
    if (found && rect?.width && (rect.top < 0 || rect.bottom > innerHeight)) {
      scrollBy(0, rect.top - 16);
      rect = found.getBoundingClientRect();
    }
  }
  // While a step's part is still to show, the panel waits where it was, so it glides straight on
  // to the part instead of dropping to the bottom in between. A step with no part goes there.
  if (rect?.width) spot.value = rect;
  else if (!waiting || !current.value.target) spot.value = undefined;
  windowHeight.value = innerHeight;
  panelHeight.value = panel.value?.offsetHeight ?? 0;
}
let settling = 0;
let waiting = false;
function settle() {
  cancelAnimationFrame(settling);
  const until = performance.now() + 1000;
  const frame = () => {
    waiting = performance.now() < until;
    measure();
    if (waiting) settling = requestAnimationFrame(frame);
  };
  frame();
}

// Above the part if there's room for the panel there, otherwise below it, and at the bottom of
// the window if there's nothing to point at.
const gap = 16;
const top = computed(() => {
  const rect = spot.value;
  const bottom = windowHeight.value - panelHeight.value - 16;
  if (!rect) return bottom;
  const above = rect.top - gap - panelHeight.value;
  return above >= 16 ? above : Math.min(rect.bottom + gap, bottom);
});

// The step's first button is ready for the keyboard, and Esc ends the tour.
const next = useTemplateRef('next');
const focusNext = () => void nextTick(() => next.value?.focus({ preventScroll: true }));
watch(step, () => {
  void nextTick(settle);
  focusNext();
});
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) emit('end');
}
const onChange = () => measure();
onMounted(() => {
  settle();
  focusNext();
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onChange);
  window.addEventListener('scroll', onChange, { passive: true });
});
onUnmounted(() => {
  cancelAnimationFrame(settling);
  resized.disconnect();
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onChange);
  window.removeEventListener('scroll', onChange);
});
</script>

<template>
  <div class="tour-layer">
    <span
      class="spot"
      :class="{ shown: spot }"
      :style="
        spot && { top: `${spot.top}px`, left: `${spot.left}px`, width: `${spot.width}px`, height: `${spot.height}px` }
      "
      aria-hidden="true"
    />
    <section ref="panel" class="card tour" aria-labelledby="tour-title" :style="{ top: `${top}px` }">
      <p class="mono count">
        Tour · <b>{{ String(step + 1).padStart(2, '0') }}</b> / {{ String(steps.length).padStart(2, '0') }}
      </p>
      <Transition name="step" mode="out-in">
        <div :key="step" aria-live="polite">
          <h2 id="tour-title">{{ current.title }}</h2>
          <p class="text">{{ current.text }}</p>
        </div>
      </Transition>
      <div class="buttons">
        <button v-if="step > 0" type="button" class="key" @click="step--">‹ Back</button>
        <button ref="next" type="button" class="key lit next" @click="last ? emit('end') : step++">
          {{ last ? 'Done' : 'Next ›' }}
        </button>
        <button v-if="!last" type="button" class="key skip" @click="emit('end')">Skip tour</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tour-layer {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

/* The part the step is about, framed with bright corner ticks a little way out from it. */
.spot {
  --t: var(--tick-bright);
  position: absolute;
  margin: -6px 0 0 -6px;
  padding: 6px;
  border-radius: 6px;
  box-shadow: 0 0 28px rgb(220 228 255 / 0.07);
  background:
    linear-gradient(var(--t), var(--t)) top left / 12px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) top left / 1px 12px no-repeat,
    linear-gradient(var(--t), var(--t)) top right / 12px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) top right / 1px 12px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom left / 12px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom left / 1px 12px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom right / 12px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom right / 1px 12px no-repeat;
  opacity: 0;
  transition:
    top 520ms var(--ease),
    left 520ms var(--ease),
    width 520ms var(--ease),
    height 520ms var(--ease),
    opacity 400ms ease;
}

.spot.shown {
  opacity: 1;
}

/* The frame, as wide as the page, over whatever's beneath. */
.tour {
  --t: var(--tick-bright);
  position: absolute;
  left: 50%;
  width: min(480px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 10px 14px 12px;
  translate: -50% 0;
  box-shadow: 0 10px 28px rgb(0 0 0 / 0.5);
  pointer-events: auto;
  transition: top 520ms var(--ease);
  animation: arrive 500ms var(--ease) both;
}

.tour::before {
  background-color: rgb(11 15 30 / 0.94);
}

@keyframes arrive {
  from {
    opacity: 0;
    translate: -50% 8px;
    filter: blur(4px);
  }
}

.count {
  margin: 0 0 4px;
}

h2 {
  display: block;
  margin: 0 0 4px;
  color: var(--starlight);
  font:
    400 16px/1.4 system-ui,
    -apple-system,
    sans-serif;
  letter-spacing: 0;
  text-transform: none;
}

h2::before,
h2::after {
  content: none;
}

.text {
  margin: 0;
  color: var(--dim);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
}

.keys {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.next {
  color: var(--starlight);
  border-color: var(--tick);
}

/* Skipping is over on the right, away from Next. */
.skip {
  margin-left: auto;
}

.step-enter-active,
.step-leave-active {
  transition:
    opacity 220ms ease,
    filter 220ms ease;
}

.step-enter-from,
.step-leave-to {
  opacity: 0;
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .spot,
  .tour {
    transition: opacity 200ms ease;
  }

  .tour {
    animation-name: fade;
  }

  .step-enter-from,
  .step-leave-to {
    filter: none;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
}
</style>
