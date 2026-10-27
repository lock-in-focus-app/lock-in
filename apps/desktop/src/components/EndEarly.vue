<script setup lang="ts">
// Also in the extension (apps/extension/components/EndEarly.vue); keep the two copies the same.
import { unlockText, type Strictness } from '@lock-in/core';
import { computed, onUnmounted, ref } from 'vue';

const props = defineProps<{
  lock: Strictness;
  /** Emergency passes left, or undefined where passes can't be used (the extension). */
  passesLeft?: number;
}>();
const emit = defineEmits<{ end: []; pass: []; cancel: [] }>();

// Gentle: a short pause before ending works.
const wait = ref(props.lock === 'gentle' ? 10 : 0);
const tick = setInterval(() => wait.value > 0 && wait.value--, 1000);
onUnmounted(() => clearInterval(tick));

// Medium: type out random text. Pasting and dropping text in are turned off.
const target = unlockText();
const typed = ref('');
const typedRight = computed(() => typed.value.trim().replace(/\s+/g, ' ') === target);
</script>

<template>
  <div class="end-early">
    <template v-if="lock === 'gentle'">
      <p>Take a breath. Still want to stop?</p>
      <button class="confirm" type="button" :disabled="wait > 0" @click="emit('end')">
        {{ wait > 0 ? `End session (${wait})` : 'End session' }}
      </button>
    </template>

    <template v-else-if="lock === 'medium'">
      <p>To end early, type this out:</p>
      <p class="target" aria-hidden="true">{{ target }}</p>
      <input
        v-model="typed"
        :aria-label="`Type: ${target}`"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        @paste.prevent
        @drop.prevent
      />
      <button class="confirm" type="button" :disabled="!typedRight" @click="emit('end')">End session</button>
    </template>

    <template v-else>
      <p>This session is in Hard mode, so it can't end until the timer is done.</p>
      <p v-if="passesLeft === undefined" class="help">An emergency pass in the Lock In app can end it.</p>
      <template v-else-if="passesLeft > 0">
        <button class="confirm" type="button" @click="emit('pass')">Use an emergency pass</button>
        <p class="help">{{ passesLeft }} left this week. Each one comes back 7 days after it's used.</p>
      </template>
      <p v-else class="help">No emergency passes left this week.</p>
    </template>

    <button class="keep" type="button" @click="emit('cancel')">Keep going</button>
  </div>
</template>

<style scoped>
.end-early {
  display: grid;
  gap: 8px;
  text-align: center;
}

p {
  margin: 0;
}

.help {
  color: var(--dim);
  font-size: 12px;
}

.target {
  padding: 8px;
  border-radius: 8px;
  background: var(--sky-raised);
  font-family: ui-monospace, monospace;
  font-size: 15px;
  letter-spacing: 0.05em;
  user-select: none;
}

input {
  padding: 8px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky);
  color: var(--starlight);
  font-family: ui-monospace, monospace;
  font-size: 15px;
  text-align: center;
}

input:focus {
  border-color: var(--glow);
  outline: none;
}

button {
  padding: 10px;
}

.confirm {
  background: var(--sky-raised);
}

.confirm:hover:not(:disabled) {
  background: var(--sky-hover);
}

.confirm:disabled {
  opacity: 0.5;
  cursor: default;
}

.keep {
  background: var(--glow);
  color: var(--sky);
  font-weight: 600;
}
</style>
