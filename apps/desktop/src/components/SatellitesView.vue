<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import SatelliteItem from './SatelliteItem.vue';

// Between sessions: the satellites still in orbit, and the task list with what was ticked off
// in the last day, which can be unticked in case it was by accident.
defineProps<{ orbiting: Satellite[]; tasks: Satellite[]; done: Satellite[] }>();
const emit = defineEmits<{ act: [id: string, action: SatelliteAction] }>();

const counted = (count: number) => String(count).padStart(2, '0');
</script>

<template>
  <div class="card list">
    <section v-if="orbiting.length" aria-labelledby="in-orbit">
      <p id="in-orbit" class="mono head">
        <span class="dot" aria-hidden="true" />In orbit · <b>{{ counted(orbiting.length) }}</b> · back after your next
        session
      </p>
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

    <section v-if="tasks.length || done.length" aria-labelledby="task-list">
      <p id="task-list" class="mono head">
        <span class="dot task" aria-hidden="true" />Tasks · <b>{{ counted(tasks.length) }}</b>
      </p>
      <ul v-if="tasks.length">
        <li v-for="task in tasks" :key="task.id">
          <label>
            <input type="checkbox" @change="emit('act', task.id, 'done')" />
            <span>{{ task.text }}</span>
          </label>
          <button
            type="button"
            class="key"
            title="Delete it for good"
            :aria-label="`Delete ${task.text}`"
            @click="emit('act', task.id, 'delete')"
          >
            ×
          </button>
        </li>
      </ul>
      <template v-if="done.length">
        <p class="mono head">Done · last 24 hours</p>
        <ul>
          <li v-for="task in done" :key="task.id" class="done">
            <label title="Untick to put it back on the list">
              <input type="checkbox" checked @change="emit('act', task.id, 'task')" />
              <span>{{ task.text }}</span>
            </label>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>

<style scoped>
.list {
  padding: 9px 11px 4px;
}

section + section {
  margin-top: 8px;
}

.head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 4px 0;
}

.dot.task {
  --c: #8fd3f0;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--line);
  font-size: 12.5px;
}

label {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  overflow-wrap: anywhere;
  cursor: pointer;
}

input {
  accent-color: #8fd3f0;
}

.done span {
  color: var(--dim);
  text-decoration: line-through;
}
</style>
