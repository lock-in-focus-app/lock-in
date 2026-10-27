<script setup lang="ts">
import type { Settings } from '@lock-in/core';
import NumberField from './NumberField.vue';

const props = defineProps<{ settings: Settings; passesLeft: number }>();
const emit = defineEmits<{ 'update:settings': [settings: Settings]; close: [] }>();

function save(patch: Partial<Settings>) {
  emit('update:settings', { ...props.settings, ...patch });
}
</script>

<template>
  <section>
    <div class="row">
      <span>Emergency passes per week</span>
      <NumberField
        label="Emergency passes per week"
        unit="passes"
        :min="0"
        :max="14"
        :model-value="settings.passesPerWeek"
        @update:model-value="save({ passesPerWeek: $event })"
      />
    </div>
    <p class="help">
      For ending a Hard session before its timer is done. Each one comes back 7 days after it's used.
      {{ passesLeft }} left right now. During a Hard session this can only go down.
    </p>

    <div class="row">
      <span>End a session after</span>
      <NumberField
        label="Minutes away before a session ends"
        unit="min away"
        :min="0"
        :max="120"
        :model-value="settings.idleMinutes"
        @update:model-value="save({ idleMinutes: $event })"
      />
    </div>
    <p class="help">
      With no keyboard or mouse input for this long, a session ends by itself, and the time away isn't counted. 0 turns
      this off.
    </p>

    <button class="done" type="button" @click="emit('close')">Done</button>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.help {
  margin: 0 0 16px;
  color: var(--dim);
  font-size: 12px;
}

.done {
  width: 100%;
  padding: 10px;
  background: var(--sky-raised);
}

.done:hover {
  background: var(--sky-hover);
}
</style>
