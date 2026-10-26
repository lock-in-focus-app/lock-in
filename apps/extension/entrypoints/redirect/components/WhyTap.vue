<script lang="ts" setup>
import type { WhyReason } from '@lock-in/core';

const why = defineModel<WhyReason | undefined>({ required: true });

const reasons: { id: WhyReason; label: string }[] = [
  { id: 'bored', label: 'Bored' },
  { id: 'stuck', label: 'Stuck' },
  { id: 'tired', label: 'Tired' },
  { id: 'curious', label: 'Curious' },
];
</script>

<template>
  <fieldset>
    <legend>What brought you here?</legend>
    <button
      v-for="reason in reasons"
      :key="reason.id"
      type="button"
      class="chip"
      :aria-pressed="why === reason.id"
      @click="why = why === reason.id ? undefined : reason.id"
    >
      {{ reason.label }}
    </button>
  </fieldset>
</template>

<style scoped>
fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 8px;
  padding: 0;
  color: var(--dim);
  font-size: 12px;
}

.chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--sky-raised);
  color: var(--dim);
  font-size: 13px;
  transition: background 150ms, color 150ms, transform 300ms var(--spring);
}

.chip:hover {
  background: var(--sky-hover);
}

.chip[aria-pressed='true'] {
  background: color-mix(in srgb, var(--glow) 25%, var(--sky-raised));
  color: var(--starlight);
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .chip {
    transition: none;
  }
}
</style>
