<script setup lang="ts">
import type { TimerSettings } from '@lock-in/core';
import { ref } from 'vue';
import { endSession, setProfileTimer, startSession, useSnapshot } from './app';
import ProfileList from './components/ProfileList.vue';
import SessionView from './components/SessionView.vue';

const snapshot = useSnapshot();
const error = ref('');

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
    </header>

    <SessionView v-if="snapshot?.session" :session="snapshot.session" @end="run(endSession)" />
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

.error {
  color: #f0a3a3;
  font-size: 12px;
}
</style>
