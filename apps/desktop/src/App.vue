<script setup lang="ts">
import type { Settings, TimerSettings } from '@lock-in/core';
import { ref } from 'vue';
import {
  endSession,
  forgetBrowser,
  setProfileTimer,
  setSettings,
  spendEmergencyPass,
  startSession,
  useSnapshot,
} from './app';
import ProfileList from './components/ProfileList.vue';
import SessionView from './components/SessionView.vue';
import SettingsView from './components/SettingsView.vue';

const snapshot = useSnapshot();
const error = ref('');
const showSettings = ref(false);

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
    <SessionView
      v-else-if="snapshot?.session"
      :session="snapshot.session"
      :passes-left="snapshot.passesLeft"
      @end="run(endSession)"
      @pass="run(spendEmergencyPass)"
    />
    <ProfileList
      v-else-if="snapshot"
      :profiles="snapshot.profiles"
      @start="(id: string) => run(() => startSession(id))"
      @set-timer="(id: string, timer: TimerSettings) => run(() => setProfileTimer(id, timer))"
    />

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

.error {
  color: #f0a3a3;
  font-size: 12px;
}
</style>
