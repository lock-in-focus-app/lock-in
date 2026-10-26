<script setup lang="ts">
import type { ProfileSummary, TimerEnd, TimerSettings } from '@lock-in/core';
import { ref } from 'vue';
import TimerEditor from './TimerEditor.vue';

defineProps<{ profiles: ProfileSummary[] }>();
const emit = defineEmits<{ start: [profileId: string]; 'set-timer': [profileId: string, timer: TimerSettings] }>();

const editing = ref<string>();

const endLabels: Record<TimerEnd, string> = {
  silent: 'ends silently',
  gentle: 'quiet notification',
  alert: 'notification and sound',
};

function timerSummary(timer: TimerSettings): string {
  return timer.minutes > 0 ? `${timer.minutes} min timer · ${endLabels[timer.onEnd]}` : 'No timer';
}
</script>

<template>
  <section>
    <p class="label">Start a session</p>
    <ul>
      <li v-for="profile in profiles" :key="profile.id">
        <div class="row">
          <button class="profile" type="button" @click="emit('start', profile.id)">
            <span class="name">{{ profile.name }}</span>
            <span class="summary">{{ timerSummary(profile.timer) }}</span>
          </button>
          <button
            class="edit"
            type="button"
            :aria-expanded="editing === profile.id"
            :aria-label="`Timer for ${profile.name}`"
            @click="editing = editing === profile.id ? undefined : profile.id"
          >
            Timer
          </button>
        </div>
        <TimerEditor
          v-if="editing === profile.id"
          :timer="profile.timer"
          @update:timer="emit('set-timer', profile.id, $event)"
        />
      </li>
    </ul>
    <p class="help">Sites for each profile are set in the browser extension's settings.</p>
  </section>
</template>

<style scoped>
.label,
.help {
  margin: 0 0 8px;
  color: var(--dim);
  font-size: 12px;
}

.help {
  margin-top: 16px;
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  gap: 4px;
}

.profile {
  flex: 1;
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  text-align: left;
  background: var(--sky-raised);
  transition:
    background 150ms,
    transform 150ms;
}

.profile:hover,
.edit:hover,
.edit[aria-expanded='true'] {
  background: var(--sky-hover);
}

.profile:active {
  transform: scale(0.98);
}

.name {
  font-weight: 600;
}

.summary {
  color: var(--dim);
  font-size: 12px;
}

.edit {
  padding: 0 12px;
  background: var(--sky-raised);
  color: var(--dim);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .profile {
    transition: none;
  }
}
</style>
