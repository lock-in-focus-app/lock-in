<script setup lang="ts">
import { hotkeyLabel } from '@lock-in/core';
import { computed, ref } from 'vue';
import { mac, maxSatelliteLength } from '../app';

// The launch box: one line for parking a thought until after the session. It sits in the frame
// with the satellites that came back and the task list (SkyPage.vue). A tiny satellite circling a
// star marks it, and the hotkey that opens the satellite box from anywhere is beside Launch, as a
// reminder (the tour says what satellites are).
const props = defineProps<{
  sessionRunning: boolean;
  /** The satellite box's hotkey, from Settings. Empty when it's turned off. */
  hotkey: string;
}>();
const emit = defineEmits<{ launch: [text: string] }>();

const text = ref('');
// A launched thought lifts off out of the box, which is clear at once for the next one.
const lifting = ref<{ key: number; text: string }[]>([]);
function launch() {
  if (!text.value.trim()) return;
  emit('launch', text.value);
  lifting.value = [...lifting.value, { key: Date.now(), text: text.value }];
  text.value = '';
}
const lifted = (key: number) => (lifting.value = lifting.value.filter((thought) => thought.key !== key));

const placeholder = computed(() =>
  props.sessionRunning ? 'Park it until this session ends' : 'Park a thought for later',
);
const hotkeyText = computed(() => (props.hotkey ? hotkeyLabel(props.hotkey, mac) : ''));
const hint = computed(
  () =>
    `Satellites: thoughts parked until after your ${props.sessionRunning ? '' : 'next '}session.` +
    (hotkeyText.value ? ` ${hotkeyText.value} launches one from anywhere.` : ''),
);
</script>

<template>
  <form class="launch" :title="hint" @submit.prevent="launch">
    <span class="emblem" aria-hidden="true"
      ><span><span /></span
    ></span>
    <span class="field">
      <input
        v-model="text"
        :maxlength="maxSatelliteLength"
        :placeholder="placeholder"
        :aria-label="`Launch a satellite. ${hint}`"
        :class="{ clearing: lifting.length }"
        autocomplete="off"
      />
      <span
        v-for="thought in lifting"
        :key="thought.key"
        class="lifting"
        aria-hidden="true"
        @animationend="lifted(thought.key)"
        >{{ thought.text }}</span
      >
    </span>
    <span v-if="hotkeyText" class="key hotkey" aria-hidden="true">{{ hotkeyText }}</span>
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

/* A tiny satellite circling a star, on a flat orbit: turning a circle and squashing it makes
   the orbit. */
.emblem {
  position: relative;
  flex: none;
  width: 18px;
  height: 18px;
}

.emblem::before {
  content: '';
  position: absolute;
  inset: 6.5px;
  border-radius: 50%;
  background: var(--glint);
  box-shadow: 0 0 6px var(--glint);
}

.emblem span {
  position: absolute;
  inset: 0;
}

.emblem > span {
  scale: 1 0.45;
}

.emblem span span {
  border: 1px solid var(--line);
  border-radius: 50%;
  animation: circle 9s linear infinite;
}

.emblem span span::after {
  content: '';
  position: absolute;
  top: -2px;
  left: calc(50% - 2px);
  width: 4px;
  height: 4px;
  border-radius: 1px;
  background: linear-gradient(#f6ead0, #bfa874);
  box-shadow: 0 0 5px rgb(225 230 255 / 0.4);
}

/* It rests while the window isn't focused, to save battery (app.ts). */
:root.resting .emblem span span {
  animation-play-state: paused;
}

@keyframes circle {
  to {
    rotate: 1turn;
  }
}

/* The hotkey, as a small key that's only a reminder. */
.hotkey {
  flex: none;
  color: var(--faint);
  pointer-events: none;
}

.field {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
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
  transition: color 400ms;
}

/* The placeholder waits until the thought has gone. */
input.clearing::placeholder {
  color: transparent;
}

/* The thought, lifting up and out of focus as it goes. */
.lifting {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  color: var(--starlight);
  font: 12px var(--mono);
  white-space: pre;
  pointer-events: none;
  animation: lift 700ms var(--ease) both;
}

@keyframes lift {
  35% {
    opacity: 1;
    filter: none;
  }

  to {
    translate: 0 -14px;
    opacity: 0;
    filter: blur(2px);
  }
}

@keyframes fade {
  35% {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
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

@media (prefers-reduced-motion: reduce) {
  .lifting {
    animation-name: fade;
  }

  .emblem span span {
    animation: none;
  }
}
</style>
