<script setup lang="ts">
import { hotkeyFromPress, hotkeyLabel } from '@lock-in/core';
import { onUnmounted, ref } from 'vue';
import { mac, pauseSatelliteHotkey, setSatelliteHotkey } from '../app';

// The satellite box's hotkey: shown as keys, with Change to record a new one by pressing it,
// and a way to turn it off. The app decides whether a hotkey can be used (hotkey.rs), and says
// why not here.
const props = defineProps<{ hotkey: string }>();

const defaultHotkey = 'Alt+KeyP';
const recording = ref(false);
const error = ref('');

async function save(hotkey: string) {
  error.value = '';
  try {
    await setSatelliteHotkey(hotkey);
  } catch (reason) {
    error.value = `Couldn't use ${hotkeyLabel(hotkey, mac)}: ${String(reason)}.`;
  }
}

function record() {
  error.value = '';
  recording.value = true;
  // So pressing the one in use here doesn't open the box.
  void pauseSatelliteHotkey(true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', stop);
}

function stop() {
  if (!recording.value) return;
  recording.value = false;
  void pauseSatelliteHotkey(false);
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('blur', stop);
}

function onKey(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();
  const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
  if (event.code === 'Escape' && plain) return stop();
  const hotkey = hotkeyFromPress(event);
  if (!hotkey) return;
  stop();
  if (hotkey !== props.hotkey) void save(hotkey);
}

onUnmounted(stop);
</script>

<template>
  <div class="line">
    <span>Satellite box hotkey</span>
    <span class="buttons">
      <span class="readout mono" aria-live="polite">
        <template v-if="recording">Press the keys · Esc cancels</template>
        <b v-else-if="hotkey">{{ hotkeyLabel(hotkey, mac) }}</b>
        <template v-else>Off</template>
      </span>
      <button class="key" type="button" @click="recording ? stop() : record()">
        {{ recording ? 'Cancel' : 'Change' }}
      </button>
      <button v-if="hotkey && !recording" class="key" type="button" @click="save('')">Turn off</button>
      <button v-else-if="!recording" class="key" type="button" @click="save(defaultHotkey)">Turn on</button>
    </span>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
</template>

<style scoped>
.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}

.buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.readout {
  margin-right: 4px;
}

.readout b {
  color: var(--starlight);
  font-size: 12px;
  letter-spacing: 0.12em;
}

.error {
  margin: 0;
  color: #f0a3a3;
  font-size: 11.5px;
}
</style>
