<script setup lang="ts">
import type { Satellite, SatelliteAction } from '@lock-in/core';
import SatelliteItem from './SatelliteItem.vue';

defineProps<{ satellites: Satellite[] }>();
const emit = defineEmits<{ act: [id: string, action: SatelliteAction] }>();
</script>

<template>
  <section class="back" aria-labelledby="came-back">
    <p id="came-back" class="label">
      {{ satellites.length === 1 ? '1 satellite came back' : `${satellites.length} satellites came back` }}
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
  margin-bottom: 24px;
}

.label {
  margin: 0 0 8px;
  color: var(--glow);
  font-size: 12px;
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
