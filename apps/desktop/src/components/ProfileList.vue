<script setup lang="ts">
import type { AppRule, ProfileSummary, Strictness, TimerEnd, TimerSettings } from '@lock-in/core';
import { starColorFor } from '@lock-in/core';
import { ref } from 'vue';
import AppRulesEditor from './AppRulesEditor.vue';
import StarColorPicker from './StarColorPicker.vue';
import { vTilt } from '../tilt';
import TimerEditor from './TimerEditor.vue';
import Unfold from './Unfold.vue';

defineProps<{ profiles: ProfileSummary[]; canHideApps: boolean }>();
const emit = defineEmits<{
  start: [profileId: string];
  'set-timer': [profileId: string, timer: TimerSettings];
  'set-apps': [profileId: string, apps: AppRule[]];
  'set-star-color': [profileId: string, color: string];
}>();

// Which profile's timer, apps or star color is open, one at a time.
type Panel = 'timer' | 'apps' | 'star';
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
        <div v-tilt class="row">
          <button class="profile" type="button" @click="emit('start', profile.id)">
            <span class="name">
              <span class="star" :style="{ color: starColorFor(profile.id, profile.starColor) }" aria-hidden="true"
                >✦</span
              >
              {{ profile.name }}
            </span>
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
          <button
            class="edit"
            type="button"
            :aria-expanded="isOpen(profile.id, 'star')"
            :aria-label="`Star color for ${profile.name}`"
            @click="toggle(profile.id, 'star')"
          >
            Star
          </button>
        </div>
        <Unfold>
          <div v-if="editing?.profileId === profile.id" :key="editing.panel" class="panel-space">
            <div class="card panel">
              <TimerEditor
                v-if="editing.panel === 'timer'"
                :timer="profile.timer"
                @update:timer="emit('set-timer', profile.id, $event)"
              />
              <AppRulesEditor
                v-else-if="editing.panel === 'apps'"
                :apps="profile.apps"
                :can-hide="canHideApps"
                @update:apps="emit('set-apps', profile.id, $event)"
              />
              <div v-else class="star-panel">
                <p>The color of this profile's stars in your sky.</p>
                <StarColorPicker
                  :color="starColorFor(profile.id, profile.starColor)"
                  :profile-name="profile.name"
                  @update:color="emit('set-star-color', profile.id, $event)"
                />
              </div>
            </div>
          </div>
        </Unfold>
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
  align-items: center;
  gap: 2px;
  padding: 4px;
}

.profile {
  flex: 1;
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  background: none;
  transition: transform 150ms;
}

.profile:active {
  transform: scale(0.98);
}

.name {
  font-weight: 600;
}

.star {
  margin-right: 2px;
  text-shadow: 0 0 6px currentColor;
}

.summary {
  color: var(--dim);
  font-size: 12px;
}

.panel-space {
  padding-top: 6px;
}

.star-panel {
  padding: 12px;
}

.star-panel p {
  margin: 0 0 8px;
  color: var(--dim);
  font-size: 12px;
}

.edit {
  align-self: stretch;
  padding: 0 10px;
  border-radius: 8px;
  background: none;
  color: var(--dim);
  font-size: 12px;
  transition:
    background 300ms,
    color 300ms;
}

.edit:hover,
.edit[aria-expanded='true'] {
  background: rgb(255 255 255 / 0.07);
  color: var(--starlight);
}

@media (prefers-reduced-motion: reduce) {
  .profile,
  .edit {
    transition: none;
  }
}
</style>
