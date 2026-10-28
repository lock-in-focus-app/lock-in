<script setup lang="ts">
import type { Snapshot } from '@lock-in/core';
import { glowFor, lifetimeFocusMs } from '@lock-in/core';
import { invoke } from '@tauri-apps/api/core';
import { onMounted, ref, useTemplateRef } from 'vue';
import { applyGlow, closeCapture, launchSatellite, maxSatelliteLength, sessionLog } from './app';

// The satellite box Alt+P opens: type the thought, press Return, and you're straight back
// where you were. It's a frame like the app's (PLAN Phase 5) in a see-through window, so it can
// drift in over whatever's open, lift off with the thought, and fade when closed.

const text = ref('');
const sessionRunning = ref(true);
const shown = ref(false);
const launched = ref(false);
const leaving = ref(false);
const error = ref('');
const input = useTemplateRef('input');
const frame = useTemplateRef('frame');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));

onMounted(() => {
  input.value?.focus();
  // Its starting place is worked out first, so it drifts in from there.
  void frame.value?.offsetHeight;
  shown.value = true;
  void invoke<Snapshot>('snapshot').then(async (snapshot) => {
    sessionRunning.value = !!snapshot.session;
    // In the glow color picked in Settings, as in the app.
    applyGlow(glowFor(snapshot.settings.glow, lifetimeFocusMs(await sessionLog())));
  });
});

async function launch() {
  if (launched.value || leaving.value) return;
  error.value = '';
  try {
    if (await launchSatellite(text.value)) {
      // A moment to see it lift off, with the frame drifting up after it, and a little longer
      // so the window only closes once the frame's gone.
      launched.value = true;
      await wait(580);
    } else {
      // Nothing to launch, so it just closes.
      leaving.value = true;
      await wait(180);
    }
    await closeCapture();
  } catch (reason) {
    launched.value = false;
    error.value = `Couldn't launch it: ${String(reason)}`;
  }
}

async function close() {
  if (launched.value || leaving.value) return;
  leaving.value = true;
  await wait(180);
  await closeCapture();
}
</script>

<template>
  <form
    ref="frame"
    class="card capture"
    :class="{ shown, launched, leaving }"
    @submit.prevent="launch"
    @keydown.esc.prevent="close"
  >
    <div class="line">
      <span class="prompt" aria-hidden="true">›</span>
      <input
        ref="input"
        v-model="text"
        :maxlength="maxSatelliteLength"
        :placeholder="sessionRunning ? 'Park it until this session ends' : 'Park a thought for later'"
        aria-label="Satellite"
        autocomplete="off"
        spellcheck="true"
      />
    </div>
    <p class="hint mono">
      <span v-if="error" class="error" role="alert">{{ error }}</span>
      <span v-else class="what"
        ><span class="dot" aria-hidden="true" />Satellites · back after
        {{ sessionRunning ? 'this' : 'your next' }} session</span
      >
      <span class="keys"><span class="key">↵ Launch</span><span class="key">Esc Close</span></span>
    </p>
  </form>
</template>

<style>
/* The window is see-through around the frame. */
html,
html body {
  height: 100%;
  background: transparent;
  overflow: hidden;
}
</style>

<style scoped>
/* Room around the frame for its shadow. */
.capture {
  position: absolute;
  inset: 22px 24px 26px;
  display: grid;
  gap: 8px;
  align-content: center;
  padding: 12px 16px 10px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 0.5);
  /* It drifts up into place and comes into focus. */
  opacity: 0;
  translate: 0 8px;
  scale: 0.985;
  filter: blur(4px);
  transition:
    opacity 360ms ease,
    translate 520ms var(--ease),
    scale 520ms var(--ease),
    filter 360ms ease;
}

/* Over whatever's open, so the tint is darker than the app's frames over its sky. */
.capture::before {
  background-color: rgb(11 15 30 / 0.94);
}

.capture:focus-within {
  --t: var(--tick-bright);
}

.capture.shown {
  opacity: 1;
  translate: 0 0;
  scale: 1;
  filter: none;
}

/* Closed: it fades back down. */
.capture.leaving {
  opacity: 0;
  translate: 0 4px;
  transition-duration: 180ms;
}

/* Launched: the thought lifts off, and the frame drifts up after it, fading out of focus. */
.capture.launched {
  opacity: 0;
  translate: 0 -6px;
  scale: 0.99;
  filter: blur(3px);
  transition:
    opacity 420ms ease-in-out 120ms,
    translate 460ms var(--ease) 120ms,
    scale 460ms var(--ease) 120ms,
    filter 420ms ease 120ms;
}

.line {
  display: flex;
  align-items: center;
  gap: 10px;
  transition:
    translate 420ms var(--ease),
    opacity 300ms ease;
}

.launched .line {
  translate: 0 -14px;
  opacity: 0;
}

.prompt {
  color: var(--dim);
  font: 15px var(--mono);
}

input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: none;
  color: var(--starlight);
  font: 15px var(--mono);
  text-overflow: ellipsis;
  caret-color: #9fe3c9;
}

input::placeholder {
  color: var(--faint);
}

.hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.what {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.what .dot {
  animation: breathe 4s ease-in-out infinite;
}

@keyframes breathe {
  50% {
    opacity: 0.4;
  }
}

.keys {
  display: flex;
  gap: 6px;
}

.error {
  color: #f0a3a3;
  text-transform: none;
}

/* Reduced motion: it only fades. */
@media (prefers-reduced-motion: reduce) {
  .capture {
    translate: none;
    scale: none;
    filter: none;
    transition: opacity 200ms ease;
  }

  .line {
    transition: opacity 200ms;
  }

  .capture.leaving,
  .capture.launched,
  .launched .line {
    translate: none;
    scale: none;
    filter: none;
  }

  .what .dot {
    animation: none;
  }
}
</style>
