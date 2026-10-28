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
  color: var(--faint);
  font: 10px/1.5 var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chip {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--sky-raised);
  color: var(--dim);
  font-size: 13px;
  transition:
    background 150ms,
    color 150ms,
    transform 300ms var(--spring);
}

.chip:hover {
  background: var(--sky-hover);
}

.chip[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--glow) 60%, transparent);
  background: color-mix(in srgb, var(--glow) 14%, var(--sky-raised));
  color: var(--starlight);
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .chip {
    transition: none;
  }
}
</style>
