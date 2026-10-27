<script setup lang="ts">
import type { AppRule, SatelliteAction, SatelliteState, Settings, TimerSettings } from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import {
  actOnSatellite,
  endSession,
  forgetBrowser,
  launchSatellite,
  setProfileApps,
  setProfileTimer,
  setSettings,
  spendEmergencyPass,
  startSession,
  useSnapshot,
} from './app';
import ProfileList from './components/ProfileList.vue';
import SatelliteLaunch from './components/SatelliteLaunch.vue';
import SatellitesBack from './components/SatellitesBack.vue';
import SatellitesView from './components/SatellitesView.vue';
import SessionView from './components/SessionView.vue';
import SettingsView from './components/SettingsView.vue';
import WeekReport from './components/WeekReport.vue';

const snapshot = useSnapshot();
const error = ref('');
// The dashboard, or Settings or the weekly report in its place.
const view = ref<'dashboard' | 'settings' | 'week'>('dashboard');
const toggle = (to: 'settings' | 'week') => (view.value = view.value === to ? 'dashboard' : to);
// The report waits between sessions, so starting one goes back to the dashboard.
watch(
  () => snapshot.value?.session?.id,
  (id) => {
    if (id && view.value === 'week') view.value = 'dashboard';
  },
);

const satellites = (state: SatelliteState) => snapshot.value?.satellites.filter((s) => s.state === state) ?? [];
const back = computed(() => satellites('back'));
const orbiting = computed(() => satellites('orbiting'));
const tasks = computed(() => satellites('task'));
// The latest first. The core only sends tasks ticked off in the last day.
const done = computed(() => satellites('done').sort((a, b) => b.stateAt - a.stateAt));
const launch = (text: string) => run(async () => void (await launchSatellite(text)));
const act = (id: string, action: SatelliteAction) => run(() => actOnSatellite(id, action));

async function run(action: () => Promise<void>) {
  error.value = '';
  try {
    await action();
  } catch (reason) {
    error.value = `Something went wrong: ${String(reason)}`;
  }
}
</script>

<template>
  <main>
    <header>
      <span class="star" aria-hidden="true">✦</span>
      <h1>Lock In</h1>
      <button
        v-if="snapshot && !snapshot.session"
        class="view"
        type="button"
        :aria-pressed="view === 'week'"
        @click="toggle('week')"
      >
        Your week
      </button>
      <button class="view" type="button" :aria-pressed="view === 'settings'" @click="toggle('settings')">
        Settings
      </button>
    </header>

    <SettingsView
      v-if="snapshot && view === 'settings'"
      :settings="snapshot.settings"
      :passes-left="snapshot.passesLeft"
      :browsers="snapshot.browsers"
      :session-running="!!snapshot.session"
      @update:settings="(settings: Settings) => run(() => setSettings(settings))"
      @forget-browser="(path: string) => run(() => forgetBrowser(path))"
      @close="view = 'dashboard'"
    />
    <template v-else-if="snapshot?.session">
      <SessionView
        :session="snapshot.session"
        :passes-left="snapshot.passesLeft"
        @end="run(endSession)"
        @pass="run(spendEmergencyPass)"
      />
      <!-- Only how many are in orbit, not what they say, so they don't pull you back in. -->
      <SatelliteLaunch class="satellites" session-running :in-orbit="orbiting.length" @launch="launch" />
    </template>
    <WeekReport v-else-if="snapshot && view === 'week'" />
    <template v-else-if="snapshot">
      <!-- Satellites wait here after a session, with nothing popping up to break the flow. -->
      <SatellitesBack v-if="back.length" :satellites="back" @act="act" />
      <ProfileList
        :profiles="snapshot.profiles"
        :can-hide-apps="snapshot.canHideApps"
        @start="(id: string) => run(() => startSession(id))"
        @set-timer="(id: string, timer: TimerSettings) => run(() => setProfileTimer(id, timer))"
        @set-apps="(id: string, apps: AppRule[]) => run(() => setProfileApps(id, apps))"
      />
      <SatelliteLaunch class="satellites" :session-running="false" :in-orbit="0" @launch="launch" />
      <SatellitesView :orbiting="orbiting" :tasks="tasks" :done="done" @act="act" />
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
main {
  max-width: 480px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.star {
  color: var(--glow);
}

.view {
  padding: 2px 8px;
  border-radius: 6px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.view:first-of-type {
  margin-left: auto;
}

.view:hover,
.view[aria-pressed='true'] {
  background: var(--sky-raised);
  color: var(--starlight);
}

.satellites {
  margin-top: 32px;
}

.error {
  color: #f0a3a3;
  font-size: 12px;
}
</style>
