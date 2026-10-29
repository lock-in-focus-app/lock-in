<script lang="ts" setup>
import {
  maxIntentionLength,
  maxPlanLength,
  waitLabel,
  waitSecondsLeft,
  type PageWait,
  type SavedLink,
} from '@lock-in/core';
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';

const props = defineProps<{
  siteName: string;
  wait: PageWait;
  requireReason: boolean;
  passMinutes: number;
  plan: string;
  links: SavedLink[];
  /** Whether "Stuck" is the answer to "what brought you here?". */
  stuck: boolean;
}>();
const emit = defineEmits<{ back: []; continue: [intention: string]; addPlan: [] }>();

const intention = ref('');
const continuing = ref(false);
const now = ref(Date.now());

// The wait runs on the clock, not the page, so it keeps counting while you're off working.
// The page only redraws it while it's in view.
const tick = setInterval(() => {
  if (document.visibilityState === 'visible') now.value = Date.now();
}, 1000);
const catchUp = () => (now.value = Date.now());
document.addEventListener('visibilitychange', catchUp);
onUnmounted(() => {
  clearInterval(tick);
  document.removeEventListener('visibilitychange', catchUp);
});

const left = computed(() => waitSecondsLeft(props.wait, now.value));
const clock = computed(() => `${Math.floor(left.value / 60)}:${String(left.value % 60).padStart(2, '0')}`);
const heading = computed(() =>
  props.wait.seconds > 0 ? `Focus for ${waitLabel(props.wait.seconds)} first` : `Still want ${props.siteName}?`,
);
const lead = computed(() => {
  if (props.wait.seconds === 0) return 'Go right ahead, or head back to what you were doing.';
  if (left.value > 0) return `If you still want ${props.siteName} after that, go right ahead.`;
  return `Time's up. If you still want ${props.siteName}, go right ahead.`;
});

const needsReason = computed(() => props.requireReason && !intention.value.trim());
const canContinue = computed(() => left.value === 0 && !needsReason.value && !continuing.value);

function proceed() {
  if (!canContinue.value) return;
  continuing.value = true;
  emit('continue', intention.value);
}

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');

// Answering "Stuck" asks for the smallest next step, to spend the wait on. It's only shown back
// here, not kept.
const nextStep = ref('');
const step = ref('');
const stepField = useTemplateRef<HTMLInputElement>('stepField');
watch(
  () => props.stuck,
  async (stuck) => {
    if (!stuck || step.value) return;
    await nextTick();
    stepField.value?.focus();
  },
);

function saveStep() {
  step.value = nextStep.value.trim();
}
</script>

<template>
  <h1>{{ heading }}</h1>
  <p class="lead">{{ lead }}</p>
  <slot />
  <p v-if="left > 0" class="clock mono" role="timer">{{ clock }}</p>

  <figure v-if="plan" class="plan">
    <figcaption class="mono">Your plan</figcaption>
    <p>{{ plan }}</p>
  </figure>
  <button v-else type="button" class="quiet add-plan" @click="emit('addPlan')">Add an if-then plan ›</button>

  <figure v-if="step" class="next">
    <figcaption class="mono">Next step</figcaption>
    <p>{{ step }}</p>
  </figure>
  <label v-else-if="stuck" class="step">
    <span class="mono">Smallest next step?</span>
    <input
      ref="stepField"
      v-model="nextStep"
      placeholder="Something you could finish in five minutes"
      :maxlength="maxPlanLength"
      @keydown.enter.prevent="saveStep"
    />
  </label>

  <div v-if="links.length" class="work">
    <a v-for="link in links" :key="link.id" class="secondary link" :href="link.url">
      <span class="title">{{ link.title || host(link.url) }} ↗</span>
      <span class="host">{{ host(link.url) }}</span>
    </a>
  </div>

  <textarea
    v-if="requireReason"
    v-model="intention"
    aria-label="What you came here for"
    placeholder="What did you come here for? (needed to go on)"
    rows="2"
    :maxlength="maxIntentionLength"
    @keydown.enter.exact.prevent="proceed"
  />

  <div class="actions">
    <button type="button" class="primary back" @click="emit('back')">Not now</button>
    <button type="button" class="secondary continue" :disabled="!canContinue" @click="proceed">
      <span class="fill" :style="{ transform: `scaleX(${wait.seconds ? 1 - left / wait.seconds : 1})` }" />
      <span class="text">Go to {{ siteName }}</span>
    </button>
  </div>
  <p class="hint">
    {{ needsReason && left === 0 ? 'Type what you came for to go on. ' : '' }}Going on gives you {{ passMinutes }}
    {{ passMinutes === 1 ? 'minute' : 'minutes' }} on {{ siteName }}.
  </p>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 300;
  line-height: 1.2;
}

.lead {
  margin: 8px 0 0;
  color: var(--dim);
  font-size: 15px;
}

/* The time left, as a big readout. */
.clock {
  margin: 20px 0 0;
  color: var(--starlight);
  font-size: 40px;
  font-weight: 200;
  letter-spacing: 0.06em;
}

figure {
  margin: 24px 0 0;
  padding-left: 14px;
  border-left: 1px solid var(--line-bright);
}

.plan figcaption,
.next figcaption,
.step .mono {
  color: var(--glow);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.plan p,
.next p {
  margin: 4px 0 0;
  font-size: 17px;
}

/* Without a plan, a quiet way to write one, in the plan's spot. */
.add-plan {
  margin-top: 20px;
}

/* Asked when "Stuck" is the answer: the smallest next step, then shown like the plan. */
.step {
  display: block;
  margin-top: 24px;
}

.step input {
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgb(8 11 22 / 0.6);
  color: var(--starlight);
  font: inherit;
  font-size: 15px;
}

.step input:focus {
  border-color: var(--tick-bright);
  outline: none;
}

/* Ways back to work: your own links. */
.work {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}

.link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  text-decoration: none;
}

.link .host {
  color: var(--dim);
  font-size: 11px;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  margin-top: 20px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgb(8 11 22 / 0.6);
  color: var(--starlight);
  font: inherit;
  font-size: 15px;
  resize: none;
}

textarea:focus {
  border-color: var(--tick-bright);
  outline: none;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 20px;
}

.continue {
  position: relative;
  overflow: hidden;
}

/* Fills up as the wait runs. */
.fill {
  position: absolute;
  inset: 0;
  background: var(--sky-hover);
  transform-origin: left;
  transition: transform 1s linear;
}

.continue:not(:disabled) .fill {
  opacity: 0;
}

.text {
  position: relative;
}

.hint {
  margin: 12px 0 0;
  color: var(--dim);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
</style>
