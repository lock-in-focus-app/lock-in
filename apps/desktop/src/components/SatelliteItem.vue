<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';

defineProps<{ satellite: Satellite; actions: SatelliteAction[] }>();
const emit = defineEmits<{ act: [action: SatelliteAction] }>();

const labels: Record<SatelliteAction, { text: string; title: string }> = {
  done: { text: 'Done', title: 'Tick it off' },
  snooze: { text: 'Later', title: 'It comes back after your next session' },
  task: { text: 'Task', title: 'Keep it on your task list' },
  delete: { text: '×', title: 'Delete it for good' },
};
</script>

<template>
  <li class="satellite">
    <span class="text">{{ satellite.text }}</span>
    <button
      v-for="action in actions"
      :key="action"
      class="key"
      type="button"
      :title="labels[action].title"
      :aria-label="action === 'delete' ? `Delete ${satellite.text}` : undefined"
      @click="emit('act', action)"
    >
      {{ labels[action].text }}
    </button>
  </li>
</template>

<style scoped>
.satellite {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  border-top: 1px solid var(--line);
  font-size: 12.5px;
}

.text {
  flex: 1;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
