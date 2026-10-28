<script lang="ts" setup>
import { maxIntentionLength } from '@lock-in/core';
import { computed, onUnmounted, ref } from 'vue';

const props = defineProps<{
  siteName: string;
  waitSeconds: number;
  requireReason: boolean;
  passMinutes: number;
}>();
const emit = defineEmits<{ back: []; continue: [intention: string] }>();

const intention = ref('');
const remaining = ref(props.waitSeconds);
const continuing = ref(false);

const needsReason = computed(() => props.requireReason && !intention.value.trim());
const canContinue = computed(() => remaining.value === 0 && !needsReason.value && !continuing.value);

// The countdown only runs while the tab is in view, so switching away doesn't skip it.
const tick = setInterval(() => {
  if (remaining.value > 0 && document.visibilityState === 'visible') remaining.value--;
}, 1000);
onUnmounted(() => clearInterval(tick));

function proceed() {
  if (!canContinue.value) return;
  continuing.value = true;
  emit('continue', intention.value);
}
</script>

<template>
  <h1>What did you come here for?</h1>
  <slot />

  <textarea
    v-model="intention"
    aria-label="What you came here for"
    :placeholder="requireReason ? 'I\'m here to… (needed to continue)' : 'I\'m here to…'"
    rows="2"
    :maxlength="maxIntentionLength"
    autofocus
    @keydown.enter.exact.prevent="proceed"
  />

  <div class="actions">
    <button type="button" class="primary back" @click="emit('back')">Back to focus</button>
    <button type="button" class="secondary continue" :disabled="!canContinue" @click="proceed">
      <span class="fill" :style="{ transform: `scaleX(${waitSeconds ? 1 - remaining / waitSeconds : 1})` }" />
      <span class="text">{{ remaining > 0 ? `Continue in ${remaining}s` : `Continue to ${siteName}` }}</span>
    </button>
  </div>
  <p class="hint">
    {{ needsReason && remaining === 0 ? 'Type what you came for to continue. ' : '' }}Continuing gives you
    {{ passMinutes }} {{ passMinutes === 1 ? 'minute' : 'minutes' }} on {{ siteName }}.
  </p>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 300;
  line-height: 1.2;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgb(8 11 22 / 0.6);
  color: var(--starlight);
  font: inherit;
  font-size: 15px;
  resize: none;
}

textarea:focus {
  border-color: var(--tick-bright);
  outline: none;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
}

.continue {
  position: relative;
  overflow: hidden;
}

/* Fills up as the countdown runs. */
.fill {
  position: absolute;
  inset: 0;
  background: var(--sky-hover);
  transform-origin: left;
  transition: transform 1s linear;
}

.continue:not(:disabled) .fill {
  opacity: 0;
}

.text {
  position: relative;
}

.hint {
  margin: 12px 0 0;
  color: var(--dim);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
</style>
