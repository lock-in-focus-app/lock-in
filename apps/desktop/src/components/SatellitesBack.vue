<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import SatelliteItem from './SatelliteItem.vue';

defineProps<{ satellites: Satellite[] }>();
const emit = defineEmits<{ act: [id: string, action: SatelliteAction] }>();
</script>

<template>
  <section class="card back" aria-labelledby="came-back">
    <p id="came-back" class="mono head" title="Thoughts you parked during your last session">
      <span class="dot" aria-hidden="true" />Came back · <b>{{ String(satellites.length).padStart(2, '0') }}</b>
    </p>
    <ul>
      <SatelliteItem
        v-for="satellite in satellites"
        :key="satellite.id"
        :satellite="satellite"
        :actions="['done', 'snooze', 'task', 'delete']"
        @act="emit('act', satellite.id, $event)"
      />
    </ul>
  </section>
</template>

<style scoped>
.back {
  padding: 9px 11px 4px;
}

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
