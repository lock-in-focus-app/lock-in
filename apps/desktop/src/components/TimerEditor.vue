<script setup lang="ts">
import type { Strictness, TimerEnd, TimerSettings } from '@lock-in/core';
import { computed } from 'vue';
import NumberField from './NumberField.vue';
import SegmentedControl from './SegmentedControl.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{ timer: TimerSettings }>();
const emit = defineEmits<{ 'update:timer': [timer: TimerSettings] }>();

const endOptions: { id: TimerEnd; label: string; title: string }[] = [
  { id: 'silent', label: 'Nothing', title: 'Nothing happens' },
  { id: 'gentle', label: 'Quiet', title: 'A quiet notification' },
  { id: 'alert', label: 'Sound', title: 'A notification and a sound' },
];

const strictnessOptions: { id: Strictness; label: string; title: string }[] = [
  { id: 'gentle', label: 'Pause', title: 'Gentle: after a short pause' },
  { id: 'medium', label: 'Type text', title: 'Medium: after typing some random text' },
  { id: 'hard', label: 'Pass only', title: 'Hard: only with an emergency pass' },
];
const strictnessHelp: Record<Strictness, string> = {
  gentle: 'Ending early just asks you to wait a moment.',
  medium: 'Ending early means typing some random text first.',
  hard: 'Ending early takes an emergency pass.',
};

// A ruler under the length, like the session's, with a marker at the setting: up to two hours,
// or further for a longer timer.
const gaugeMax = computed(() => Math.max(120, Math.ceil(props.timer.minutes / 60) * 60));
const gaugeMarks = computed(() => [0, 1, 2, 3, 4].map((i) => (gaugeMax.value / 4) * i));

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
          :max="480"
          :step="5"
          :model-value="timer.minutes"
          @update:model-value="save({ minutes: $event })"
        />
      </div>
      <template v-if="timer.minutes > 0">
        <div class="gauge" aria-hidden="true">
          <span class="now" :style="{ left: `${(timer.minutes / gaugeMax) * 100}%` }" />
        </div>
        <p class="scale mono" aria-hidden="true">
          <span v-for="mark in gaugeMarks" :key="mark">{{ mark }}</span>
        </p>
      </template>
      <p class="help">0 for no timer. Either way, the session runs until you end it.</p>
    </div>

    <template v-if="timer.minutes > 0">
      <div class="field">
        <div class="line">When it's done</div>
        <SegmentedControl
          label="When the timer is done"
          :options="endOptions"
          :model-value="timer.onEnd"
          @update:model-value="save({ onEnd: $event })"
        />
      </div>

      <div class="field">
        <div class="line">Ending early</div>
        <SegmentedControl
          label="Ending the session before the timer is done"
          :options="strictnessOptions"
          :model-value="timer.strictness"
          @update:model-value="save({ strictness: $event })"
        />
        <p class="help">
          {{ strictnessHelp[timer.strictness] }} Once the timer is done, the session ends with one click.
        </p>
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

/* A tick every 5 minutes, with a marker in the profile's color at the length. */
.gauge {
  position: relative;
  height: 12px;
  margin-top: 4px;
  background: repeating-linear-gradient(90deg, rgb(220 228 255 / 0.22) 0 1px, transparent 1px calc(100% / 24)) bottom /
    100% 50% no-repeat;
}

.now {
  position: absolute;
  top: -3px;
  width: 1px;
  height: 16px;
  background: var(--c, var(--glow));
  box-shadow: 0 0 8px var(--c, var(--glow));
  transition: left 400ms var(--ease);
}

.scale {
  display: flex;
  justify-content: space-between;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .now {
    transition: none;
  }
}
</style>
