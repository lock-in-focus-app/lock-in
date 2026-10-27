<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import SatelliteItem from './SatelliteItem.vue';

// Between sessions: the satellites still in orbit, and the task list.
defineProps<{ orbiting: Satellite[]; tasks: Satellite[] }>();
const emit = defineEmits<{ act: [id: string, action: SatelliteAction] }>();
</script>

<template>
  <section v-if="orbiting.length" aria-labelledby="in-orbit">
    <p id="in-orbit" class="label">In orbit · back after your next session</p>
    <ul>
      <SatelliteItem
        v-for="satellite in orbiting"
        :key="satellite.id"
        :satellite="satellite"
        :actions="['done', 'task', 'delete']"
        @act="emit('act', satellite.id, $event)"
      />
    </ul>
  </section>

  <section v-if="tasks.length" aria-labelledby="tasks">
    <p id="tasks" class="label">Tasks</p>
    <ul class="tasks">
      <li v-for="task in tasks" :key="task.id">
        <label>
          <input type="checkbox" @change="emit('act', task.id, 'done')" />
          <span>{{ task.text }}</span>
        </label>
        <button
          type="button"
          class="delete"
          :aria-label="`Delete ${task.text}`"
          @click="emit('act', task.id, 'delete')"
        >
          Delete
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
section {
  margin-top: 16px;
}

.label {
  margin: 0 0 8px;
  color: var(--dim);
  font-size: 12px;
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tasks {
  gap: 2px;
}

.tasks li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--sky-raised);
}

.tasks label {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  overflow-wrap: anywhere;
  cursor: pointer;
}

input {
  accent-color: var(--glow);
}

.delete {
  padding: 2px 8px;
  border-radius: 6px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.delete:hover {
  background: var(--sky-hover);
  color: var(--starlight);
}
</style>
