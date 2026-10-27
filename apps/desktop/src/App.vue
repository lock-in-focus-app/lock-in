<script setup lang="ts">
import type { AppRule, SatelliteAction, SatelliteState, Settings, TimerSettings } from '@lock-in/core';
import { computed, ref } from 'vue';
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

const snapshot = useSnapshot();
const error = ref('');
const showSettings = ref(false);

const satellites = (state: SatelliteState) => snapshot.value?.satellites.filter((s) => s.state === state) ?? [];
const back = computed(() => satellites('back'));
const orbiting = computed(() => satellites('orbiting'));
const tasks = computed(() => satellites('task'));
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
      <button class="settings" type="button" :aria-pressed="showSettings" @click="showSettings = !showSettings">
        Settings
      </button>
    </header>

    <SettingsView
      v-if="snapshot && showSettings"
      :settings="snapshot.settings"
      :passes-left="snapshot.passesLeft"
      :browsers="snapshot.browsers"
      :session-running="!!snapshot.session"
      @update:settings="(settings: Settings) => run(() => setSettings(settings))"
      @forget-browser="(path: string) => run(() => forgetBrowser(path))"
      @close="showSettings = false"
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
      <SatellitesView :orbiting="orbiting" :tasks="tasks" @act="act" />
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

.settings {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 6px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.settings:hover,
.settings[aria-pressed='true'] {
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
