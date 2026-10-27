<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import { vTilt } from '../tilt';

defineProps<{ satellite: Satellite; actions: SatelliteAction[] }>();
const emit = defineEmits<{ act: [action: SatelliteAction] }>();

const labels: Record<SatelliteAction, { text: string; title: string }> = {
  done: { text: 'Done', title: 'Tick it off' },
  snooze: { text: 'Snooze', title: 'It comes back after your next session' },
  task: { text: 'Task', title: 'Keep it on your task list' },
  delete: { text: 'Delete', title: 'Delete it for good' },
};
</script>

<template>
  <li v-tilt class="satellite">
    <p class="text">{{ satellite.text }}</p>
    <div class="actions">
      <button
        v-for="action in actions"
        :key="action"
        type="button"
        :class="action"
        :title="labels[action].title"
        @click="emit('act', action)"
      >
        {{ labels[action].text }}
      </button>
    </div>
  </li>
</template>

<style scoped>
.satellite {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--sky-raised);
}

.text {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.actions {
  display: flex;
  gap: 4px;
}

button {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--sky-hover);
  color: var(--dim);
  font-size: 12px;
}

button:hover {
  color: var(--starlight);
}

.done:hover {
  background: var(--glow);
  color: var(--sky);
}

.delete {
  margin-left: auto;
  background: none;
}
</style>
