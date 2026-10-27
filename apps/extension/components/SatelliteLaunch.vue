<script setup lang="ts">
import { maxSatelliteLength } from '@lock-in/core';
import { computed, onUnmounted, ref } from 'vue';

// The Satellites box in the popup and on redirect pages: type the thought, press Return, and
// get back to what you were doing. `compact` is for the narrow popup, where the full
// placeholder doesn't fit.
const props = defineProps<{
  sessionRunning: boolean;
  inOrbit: number;
  linked: boolean;
  autofocus?: boolean;
  compact?: boolean;
}>();

const text = ref('');
const launched = ref(false);
let launchedTimer: ReturnType<typeof setTimeout> | undefined;
onUnmounted(() => clearTimeout(launchedTimer));

async function launch() {
  if (!text.value.trim()) return;
  await launchSatellite(text.value);
  text.value = '';
  launched.value = true;
  clearTimeout(launchedTimer);
  launchedTimer = setTimeout(() => (launched.value = false), 2500);
}

const comesBack = computed(() => `back after your ${props.sessionRunning ? '' : 'next '}session`);
const placeholder = computed(() =>
  props.compact ? 'Distracting thought? Launch it.' : `Distracting thought? Launch it — it'll come ${comesBack.value}.`,
);
const help = computed(() => {
  if (props.linked) return launched.value ? 'Launched · it waits in the Lock In app' : 'Kept in the Lock In app';
  const parts = [
    launched.value && 'Launched',
    props.inOrbit > 0 && `${props.inOrbit} in orbit`,
    // The placeholder says when it comes back, unless it's too narrow to.
    props.compact && comesBack.value,
  ].filter((part) => typeof part === 'string');
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
});
</script>

<template>
  <form class="launch" @submit.prevent="launch">
    <label class="label" for="satellite">Satellites · thoughts for later</label>
    <div class="row">
      <input
        id="satellite"
        v-model="text"
        :maxlength="maxSatelliteLength"
        :placeholder="placeholder"
        :title="placeholder"
        :autofocus="autofocus"
        autocomplete="off"
      />
      <button type="submit" :disabled="!text.trim()">Launch</button>
    </div>
    <p v-if="help" class="help" :class="{ launched }" role="status">{{ help }}</p>
  </form>
</template>

<style scoped>
.launch {
  display: grid;
  gap: 6px;
  text-align: left;
}

.label,
.help {
  margin: 0;
  color: var(--dim);
  font-size: 12px;
}

.help.launched {
  color: var(--glow);
}

.row {
  display: flex;
  gap: 4px;
}

input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky);
  color: var(--starlight);
  font: inherit;
  text-overflow: ellipsis;
}

input:focus {
  border-color: var(--glow);
  outline: none;
}

button {
  padding: 0 14px;
  background: var(--sky-raised);
}

button:hover:not(:disabled) {
  background: var(--sky-hover);
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
