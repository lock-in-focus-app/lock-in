<script setup lang="ts">
import type { Strictness, TimerEnd, TimerSettings } from '@lock-in/core';
import NumberField from './NumberField.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{ timer: TimerSettings }>();
const emit = defineEmits<{ 'update:timer': [timer: TimerSettings] }>();

const endOptions: { id: TimerEnd; label: string }[] = [
  { id: 'silent', label: 'Nothing happens' },
  { id: 'gentle', label: 'Quiet notification' },
  { id: 'alert', label: 'Notification and sound' },
];

const strictnessOptions: { id: Strictness; label: string }[] = [
  { id: 'gentle', label: 'After a short pause' },
  { id: 'medium', label: 'After typing random text' },
  { id: 'hard', label: 'Only with an emergency pass' },
];

function save(patch: Partial<TimerSettings>) {
  emit('update:timer', { ...props.timer, ...patch });
}
</script>

<template>
  <div class="editor">
    <div class="row">
      <span>Length</span>
      <NumberField
        label="Timer length in minutes"
        unit="min"
        :min="0"
        :max="480"
        :model-value="timer.minutes"
        @update:model-value="save({ minutes: $event })"
      />
    </div>
    <p class="row-help">0 for no timer. Either way, the session runs until you end it.</p>

    <template v-if="timer.minutes > 0">
      <div class="row">
        <span>When it's done</span>
        <select
          aria-label="When the timer is done"
          :value="timer.onEnd"
          @change="save({ onEnd: ($event.target as HTMLSelectElement).value as TimerEnd })"
        >
          <option v-for="option in endOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </div>

      <div class="row">
        <span>Ending early</span>
        <select
          aria-label="Ending the session before the timer is done"
          :value="timer.strictness"
          @change="save({ strictness: ($event.target as HTMLSelectElement).value as Strictness })"
        >
          <option v-for="option in strictnessOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
      </div>
      <p class="row-help">Once the timer is done, the session ends with one click.</p>

      <ToggleSwitch
        label="Show time since done"
        :model-value="timer.showSinceDone"
        @update:model-value="save({ showSinceDone: $event })"
      />
      <p class="row-help">Shows "Done · 37 min ago" instead of just "Done", so you can see the extra you did.</p>
    </template>
  </div>
</template>

<style scoped>
/* Shown inside a glass card (ProfileList.vue). */
.editor {
  padding: 4px 12px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.row-help {
  margin: -4px 0 8px;
  color: var(--dim);
  font-size: 12px;
}

select {
  padding: 6px 8px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky);
  color: var(--starlight);
  font: inherit;
}

select:focus {
  border-color: var(--glow);
  outline: none;
}
</style>
