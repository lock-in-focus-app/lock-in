<script setup lang="ts">
import { computed, ref } from 'vue';
import { maxSatelliteLength } from '../app';

const props = defineProps<{ sessionRunning: boolean; inOrbit: number }>();
const emit = defineEmits<{ launch: [text: string] }>();

const text = ref('');
function launch() {
  if (!text.value.trim()) return;
  emit('launch', text.value);
  text.value = '';
}

const hotkey = navigator.userAgent.includes('Mac') ? '⌥P' : 'Alt+P';
const placeholder = computed(
  () => `Distracting thought? Launch it — it'll come back after your ${props.sessionRunning ? '' : 'next '}session.`,
);
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
        autocomplete="off"
      />
      <button type="submit" :disabled="!text.trim()">Launch</button>
    </div>
    <p class="help">
      <template v-if="inOrbit">{{ inOrbit }} in orbit · </template>
      <kbd>{{ hotkey }}</kbd> launches one from anywhere
    </p>
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

kbd {
  font: inherit;
  color: var(--starlight);
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
