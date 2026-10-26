<script setup lang="ts">
import { formatClock, timerStatus, type ActiveSession } from '@lock-in/core';
import { computed } from 'vue';
import { useNow } from '../app';

const props = defineProps<{ session: ActiveSession }>();
const emit = defineEmits<{ end: [] }>();

const now = useNow();
const status = computed(() => timerStatus(props.session, now.value));
const minutes = computed(() => props.session.timer?.minutes ?? 0);

// The quiet timer: once it's done the session keeps going, and it only says "Done",
// unless the profile asks to show how long ago.
const clock = computed(() => {
  const s = status.value;
  if (s.state === 'running') return formatClock(s.remainingMs);
  if (s.state === 'none') return formatClock(s.elapsedMs);
  if (!props.session.timer?.showSinceDone) return 'Done';
  const since = Math.floor(s.sinceMs / 60_000);
  return since < 1 ? 'Done · just now' : `Done · ${since} min ago`;
});

const detail = computed(() => {
  const started = new Date(props.session.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const timer = status.value.state === 'running' ? `left of ${minutes.value} min` : 'No timer';
  return status.value.state === 'done' ? `Started ${started}` : `${timer} · started ${started}`;
});
</script>

<template>
  <section class="session">
    <p class="label">Locked in · {{ session.profileName }}</p>
    <p class="clock" :class="{ done: status.state === 'done' }">{{ clock }}</p>
    <p class="detail">{{ detail }}</p>
    <button class="end" type="button" @click="emit('end')">End session</button>
  </section>
</template>

<style scoped>
.session {
  text-align: center;
}

.label,
.detail {
  margin: 0;
  color: var(--dim);
  font-size: 13px;
}

.clock {
  margin: 12px 0 4px;
  font-size: 56px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

.clock.done {
  font-size: 36px;
}

.end {
  width: 100%;
  margin-top: 32px;
  padding: 12px;
  background: var(--sky-raised);
}

.end:hover {
  background: var(--sky-hover);
}
</style>
