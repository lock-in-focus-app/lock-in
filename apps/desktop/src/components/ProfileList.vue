<script setup lang="ts">
import type { AppRule, ProfileSummary, Strictness, TimerEnd, TimerSettings } from '@lock-in/core';
import { ref } from 'vue';
import AppRulesEditor from './AppRulesEditor.vue';
import TimerEditor from './TimerEditor.vue';

defineProps<{ profiles: ProfileSummary[]; canHideApps: boolean }>();
const emit = defineEmits<{
  start: [profileId: string];
  'set-timer': [profileId: string, timer: TimerSettings];
  'set-apps': [profileId: string, apps: AppRule[]];
}>();

// Which profile's timer or apps are open, one at a time.
type Panel = 'timer' | 'apps';
const editing = ref<{ profileId: string; panel: Panel }>();
const isOpen = (profileId: string, panel: Panel) =>
  editing.value?.profileId === profileId && editing.value.panel === panel;
const toggle = (profileId: string, panel: Panel) =>
  (editing.value = isOpen(profileId, panel) ? undefined : { profileId, panel });

const endLabels: Record<TimerEnd, string> = {
  silent: 'ends silently',
  gentle: 'quiet notification',
  alert: 'notification and sound',
};

const strictnessLabels: Record<Strictness, string> = {
  gentle: '',
  medium: ' · Medium',
  hard: ' · Hard',
};

function timerSummary(timer: TimerSettings): string {
  if (timer.minutes <= 0) return 'No timer';
  return `${timer.minutes} min timer${strictnessLabels[timer.strictness]} · ${endLabels[timer.onEnd]}`;
}

function summary(profile: ProfileSummary): string {
  const apps = profile.apps.length;
  const appCount = apps === 0 ? '' : ` · ${apps} ${apps === 1 ? 'app' : 'apps'}`;
  return timerSummary(profile.timer) + appCount;
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
            <span class="summary">{{ summary(profile) }}</span>
          </button>
          <button
            class="edit"
            type="button"
            :aria-expanded="isOpen(profile.id, 'timer')"
            :aria-label="`Timer for ${profile.name}`"
            @click="toggle(profile.id, 'timer')"
          >
            Timer
          </button>
          <button
            class="edit"
            type="button"
            :aria-expanded="isOpen(profile.id, 'apps')"
            :aria-label="`Apps for ${profile.name}`"
            @click="toggle(profile.id, 'apps')"
          >
            Apps
          </button>
        </div>
        <TimerEditor
          v-if="isOpen(profile.id, 'timer')"
          :timer="profile.timer"
          @update:timer="emit('set-timer', profile.id, $event)"
        />
        <AppRulesEditor
          v-if="isOpen(profile.id, 'apps')"
          :apps="profile.apps"
          :can-hide="canHideApps"
          @update:apps="emit('set-apps', profile.id, $event)"
        />
      </li>
    </ul>
    <p class="help">Sites for each profile are set in the browser extension's settings, and apps here.</p>
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
