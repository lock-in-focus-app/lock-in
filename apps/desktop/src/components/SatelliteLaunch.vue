<script setup lang="ts">
import { hotkeyLabel } from '@lock-in/core';
import { computed, ref } from 'vue';
import { mac, maxSatelliteLength } from '../app';

// The launch box: one line for parking a thought until after the session. It sits in the frame
// with the satellites that came back and the task list (SkyPage.vue).
const props = defineProps<{
  sessionRunning: boolean;
  /** The satellite box's hotkey, from Settings. Empty when it's turned off. */
  hotkey: string;
}>();
const emit = defineEmits<{ launch: [text: string] }>();

const text = ref('');
function launch() {
  if (!text.value.trim()) return;
  emit('launch', text.value);
  text.value = '';
}

const placeholder = computed(() =>
  props.sessionRunning ? 'Park it until this session ends' : 'Park a thought for later',
);
const hint = computed(
  () =>
    `Satellites: thoughts parked until after your ${props.sessionRunning ? '' : 'next '}session.` +
    (props.hotkey ? ` ${hotkeyLabel(props.hotkey, mac)} launches one from anywhere.` : ''),
);
</script>

<template>
  <form class="launch" :title="hint" @submit.prevent="launch">
    <span class="prompt" aria-hidden="true">›</span>
    <input
      v-model="text"
      :maxlength="maxSatelliteLength"
      :placeholder="placeholder"
      :aria-label="`Launch a satellite. ${hint}`"
      autocomplete="off"
    />
    <button class="mono" type="submit" :disabled="!text.trim()">↵ Launch</button>
  </form>
</template>

<style scoped>
.launch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.prompt {
  color: var(--dim);
  font: 12px var(--mono);
}

input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  color: var(--starlight);
  font: 12px var(--mono);
  text-overflow: ellipsis;
  caret-color: #9fe3c9;
}

input::placeholder {
  color: var(--faint);
}

button {
  padding: 0;
  border-radius: 0;
  background: none;
  transition: color 300ms;
}

button:hover:not(:disabled) {
  color: var(--starlight);
}

button:disabled {
  cursor: default;
}
</style>
