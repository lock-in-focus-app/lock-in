<script setup lang="ts">
import type { Snapshot } from '@lock-in/core';
import { invoke } from '@tauri-apps/api/core';
import { onMounted, ref, useTemplateRef } from 'vue';
import { closeCapture, launchSatellite, maxSatelliteLength } from './app';

// The satellite box Alt+P opens: type the thought, press Return, and you're straight back
// where you were.

const text = ref('');
const sessionRunning = ref(true);
const launched = ref(false);
const error = ref('');
const input = useTemplateRef('input');

onMounted(() => {
  input.value?.focus();
  void invoke<Snapshot>('snapshot').then((snapshot) => (sessionRunning.value = !!snapshot.session));
});

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function launch() {
  if (launched.value) return;
  error.value = '';
  try {
    if (await launchSatellite(text.value)) {
      // A moment to see it lift off.
      launched.value = true;
      await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : 220));
    }
    await closeCapture();
  } catch (reason) {
    launched.value = false;
    error.value = `Couldn't launch it: ${String(reason)}`;
  }
}
</script>

<template>
  <form class="capture" @submit.prevent="launch" @keydown.esc.prevent="closeCapture()">
    <input
      ref="input"
      v-model="text"
      :class="{ launched }"
      :maxlength="maxSatelliteLength"
      :placeholder="`Distracting thought? Launch it — it'll come back after your ${sessionRunning ? '' : 'next '}session.`"
      aria-label="Satellite"
      autocomplete="off"
      spellcheck="true"
    />
    <p class="hint">
      <span v-if="error" class="error" role="alert">{{ error }}</span>
      <span v-else>Satellites · thoughts for later</span>
      <span class="keys"><kbd>↵</kbd> launch · <kbd>esc</kbd> close</span>
    </p>
  </form>
</template>

<style scoped>
.capture {
  display: grid;
  gap: 6px;
  height: 100vh;
  box-sizing: border-box;
  padding: 12px 16px 10px;
  align-content: center;
}

input {
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--starlight);
  font: inherit;
  font-size: 17px;
  outline: none;
  transition:
    transform 220ms var(--spring),
    opacity 220ms;
}

input::placeholder {
  color: var(--dim);
}

/* Lifts off into orbit. */
input.launched {
  transform: translateY(-10px);
  opacity: 0;
}

.hint {
  display: flex;
  justify-content: space-between;
  margin: 0;
  color: var(--dim);
  font-size: 11px;
}

.error {
  color: #f0a3a3;
}

kbd {
  font: inherit;
  color: var(--starlight);
}

@media (prefers-reduced-motion: reduce) {
  input {
    transition: none;
  }
}
</style>
