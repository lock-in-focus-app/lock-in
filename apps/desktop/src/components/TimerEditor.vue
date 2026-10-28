<script setup lang="ts">
import type { Strictness, TimerEnd, TimerSettings } from '@lock-in/core';
import { ref } from 'vue';
import LengthDial from './LengthDial.vue';
import NumberField from './NumberField.vue';
import SegmentedControl from './SegmentedControl.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{ timer: TimerSettings }>();
const emit = defineEmits<{ 'update:timer': [timer: TimerSettings] }>();

/** The longest timer, 6 hours, as in the app's core (timer.rs). */
const maxMinutes = 360;
/** The length while the dial is being dragged, so the stepper follows along. */
const dragging = ref<number>();

// Each choice spells out what it does, on its button and in the line above, so nothing depends
// on hovering (which a touch screen can't do).
const endOptions: { id: TimerEnd; label: string; detail: string; help: string }[] = [
  { id: 'silent', label: 'Nothing', detail: 'silent', help: 'Nothing happens when the timer is done.' },
  { id: 'gentle', label: 'Quiet', detail: 'notification', help: 'A quiet notification when the timer is done.' },
  {
    id: 'alert',
    label: 'Sound',
    detail: 'with sound',
    help: 'A notification and a sound when the timer is done.',
  },
];

const strictnessOptions: { id: Strictness; label: string; detail: string; help: string }[] = [
  {
    id: 'gentle',
    label: 'Gentle',
    detail: 'a short pause',
    help: 'Gentle: ending before the timer is done just asks you to wait a moment.',
  },
  {
    id: 'medium',
    label: 'Medium',
    detail: 'type some text',
    help: 'Medium: ending before the timer is done means typing out some random text first.',
  },
  {
    id: 'hard',
    label: 'Hard',
    detail: 'a pass only',
    help: "Hard: the session can't end before the timer is done without an emergency pass (Settings).",
  },
];

const helpFor = <T extends string>(options: { id: T; help: string }[], id: T) =>
  options.find((option) => option.id === id)?.help;

function save(patch: Partial<TimerSettings>) {
  emit('update:timer', { ...props.timer, ...patch });
}
</script>

<template>
  <div class="editor">
    <div class="field">
      <div class="line">
        Length
        <NumberField
          label="Timer length in minutes"
          unit="min"
          :min="0"
          :max="maxMinutes"
          :step="5"
          :model-value="dragging ?? timer.minutes"
          @update:model-value="save({ minutes: $event })"
        />
      </div>
      <LengthDial
        label="Timer length"
        :max="maxMinutes"
        :model-value="timer.minutes"
        @update:model-value="save({ minutes: $event })"
        @preview="dragging = $event"
      />
      <p class="help">
        Drag the ruler or click a spot on it. 0 for no timer. Either way, the session runs until you end it.
      </p>
    </div>

    <template v-if="timer.minutes > 0">
      <div class="field">
        <div class="line">When it's done</div>
        <p class="info" aria-live="polite"><span aria-hidden="true">ⓘ</span> {{ helpFor(endOptions, timer.onEnd) }}</p>
        <SegmentedControl
          label="When the timer is done"
          :options="endOptions"
          :model-value="timer.onEnd"
          @update:model-value="save({ onEnd: $event })"
        />
      </div>

      <div class="field">
        <div class="line">Ending early</div>
        <p class="info" aria-live="polite">
          <span aria-hidden="true">ⓘ</span> {{ helpFor(strictnessOptions, timer.strictness) }}
        </p>
        <SegmentedControl
          label="Ending the session before the timer is done"
          :options="strictnessOptions"
          :model-value="timer.strictness"
          @update:model-value="save({ strictness: $event })"
        />
        <p class="help">Once the timer is done, any session ends with one click.</p>
      </div>

      <div class="field">
        <ToggleSwitch
          label="Show time since done"
          :model-value="timer.showSinceDone"
          @update:model-value="save({ showSinceDone: $event })"
        />
        <p class="help">Shows "Done · 37 min ago" instead of just "Done", so you can see the extra you did.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 6px;
  padding: 10px 0;
}

.field + .field {
  border-top: 1px dashed var(--line);
}

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}

.help {
  margin: 0;
  color: var(--faint);
  font-size: 11.5px;
}

/* What the picked choice does, changing with it. */
.info {
  margin: 0;
  color: var(--dim);
  font-size: 11.5px;
}

.info span {
  color: var(--c, var(--glow));
}
</style>
