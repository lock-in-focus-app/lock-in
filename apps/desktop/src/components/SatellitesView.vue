<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import { reactive } from 'vue';
import ListMotion from './ListMotion.vue';
import SatelliteItem from './SatelliteItem.vue';
import Unfold from './Unfold.vue';

// Between sessions: the satellites still in orbit, and the task list with what was ticked off
// in the last day, which can be unticked in case it was by accident.
defineProps<{ orbiting: Satellite[]; tasks: Satellite[]; done: Satellite[] }>();
const emit = defineEmits<{ act: [id: string, action: SatelliteAction] }>();

const counted = (count: number) => String(count).padStart(2, '0');

// What was done with each one, so it leaves its list its own way (ListMotion.vue).
const leaving = reactive(new Map<string, SatelliteAction>());
function act(id: string, action: SatelliteAction) {
  leaving.set(id, action);
  emit('act', id, action);
}
</script>

<template>
  <div class="list">
    <Unfold>
      <section v-if="orbiting.length" aria-labelledby="in-orbit">
        <p id="in-orbit" class="mono head">
          <span class="dot" aria-hidden="true" />In orbit · <b>{{ counted(orbiting.length) }}</b> · back after your next
          session
        </p>
        <ListMotion>
          <SatelliteItem
            v-for="satellite in orbiting"
            :key="satellite.id"
            :satellite="satellite"
            :actions="['done', 'task', 'delete']"
            :data-leave="leaving.get(satellite.id)"
            @act="act(satellite.id, $event)"
          />
        </ListMotion>
      </section>
    </Unfold>

    <Unfold>
      <section v-if="tasks.length || done.length" aria-labelledby="task-list">
        <p id="task-list" class="mono head">
          <span class="dot task" aria-hidden="true" />Tasks · <b>{{ counted(tasks.length) }}</b>
        </p>
        <ListMotion>
          <li v-for="task in tasks" :key="task.id" :data-leave="leaving.get(task.id)">
            <label>
              <input type="checkbox" @change="act(task.id, 'done')" />
              <span>{{ task.text }}</span>
            </label>
            <button
              type="button"
              class="key"
              title="Delete it for good"
              :aria-label="`Delete ${task.text}`"
              @click="act(task.id, 'delete')"
            >
              ×
            </button>
          </li>
        </ListMotion>
        <Unfold>
          <div v-if="done.length">
            <p class="mono head">Done · last 24 hours</p>
            <ListMotion>
              <li v-for="task in done" :key="task.id" class="done" :data-leave="leaving.get(task.id)">
                <label title="Untick to put it back on the list">
                  <input type="checkbox" checked @change="act(task.id, 'task')" />
                  <span>{{ task.text }}</span>
                </label>
              </li>
            </ListMotion>
          </div>
        </Unfold>
      </section>
    </Unfold>
  </div>
</template>

<style scoped>
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
