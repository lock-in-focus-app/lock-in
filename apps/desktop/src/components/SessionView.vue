<script setup lang="ts">
import { endLock, formatClock, timerStatus, type ActiveSession } from '@lock-in/core';
import { computed, ref } from 'vue';
import { useNow } from '../app';
import EndEarly from './EndEarly.vue';

const props = defineProps<{ session: ActiveSession; passesLeft: number }>();
const emit = defineEmits<{ end: []; pass: [] }>();

const now = useNow();
const status = computed(() => timerStatus(props.session, now.value));

// Ending before the timer is done goes through the profile's strictness first.
const lock = computed(() => endLock(props.session, now.value));
const endingEarly = ref(false);
function requestEnd() {
  if (lock.value) endingEarly.value = true;
  else emit('end');
}
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
    <p v-if="session.broken" class="broken">
      Counts as broken: a browser had to be closed for running without the extension.
    </p>
    <EndEarly
      v-if="endingEarly && lock"
      class="end-early"
      :lock="lock"
      :passes-left="passesLeft"
      @end="emit('end')"
      @pass="emit('pass')"
      @cancel="endingEarly = false"
    />
    <button v-else class="end" type="button" @click="requestEnd">End session</button>
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

.broken {
  margin: 8px 0 0;
  color: var(--dim);
  font-size: 12px;
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

.end-early {
  margin-top: 32px;
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
