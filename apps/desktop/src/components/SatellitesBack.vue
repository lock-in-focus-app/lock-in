<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import { reactive } from 'vue';
import ListMotion from './ListMotion.vue';
import SatelliteItem from './SatelliteItem.vue';

defineProps<{ satellites: Satellite[] }>();
const emit = defineEmits<{ act: [id: string, action: SatelliteAction] }>();

// What was done with each one, so it leaves the list its own way (ListMotion.vue).
const leaving = reactive(new Map<string, SatelliteAction>());
function act(id: string, action: SatelliteAction) {
  leaving.set(id, action);
  emit('act', id, action);
}
</script>

<template>
  <section class="back" aria-labelledby="came-back">
    <p id="came-back" class="mono head" title="Thoughts you parked during your last session">
      <span class="dot" aria-hidden="true" />Came back · <b>{{ String(satellites.length).padStart(2, '0') }}</b>
    </p>
    <ListMotion>
      <SatelliteItem
        v-for="satellite in satellites"
        :key="satellite.id"
        :satellite="satellite"
        :actions="['done', 'snooze', 'task', 'delete']"
        :data-leave="leaving.get(satellite.id)"
        @act="act(satellite.id, $event)"
      />
    </ListMotion>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
}

.dot {
  --c: var(--glow);
}

ul {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}
</style>
