<script setup lang="ts" generic="T extends string">
// A segmented switch, like an instrument's: one of a few options, the picked one lit.
defineProps<{ options: { id: T; label: string; title?: string }[]; label: string }>();
const value = defineModel<T>({ required: true });
</script>

<template>
  <span class="card segments" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      :title="option.title"
      :aria-pressed="value === option.id"
      @click="value = option.id"
    >
      {{ option.label }}
    </button>
  </span>
</template>

<style scoped>
.segments {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  padding: 2px;
}

button {
  padding: 6px 4px;
  border-radius: 2px;
  background: none;
  color: var(--faint);
  font: 9.5px var(--mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition:
    color 300ms,
    background 300ms,
    box-shadow 300ms;
}

button:hover {
  color: var(--dim);
}

button[aria-pressed='true'] {
  color: var(--starlight);
  background: rgb(220 228 255 / 0.08);
  box-shadow: inset 0 -1px 0 var(--c, #cfe0ff);
}
</style>
