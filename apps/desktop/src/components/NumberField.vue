<script lang="ts" setup>
const props = defineProps<{ label: string; min: number; max: number; unit: string }>();
const value = defineModel<number>({ required: true });

// Commits on change rather than every keystroke, and snaps the field back into range.
function commit(event: Event) {
  const input = event.target as HTMLInputElement;
  const parsed = Math.round(Number(input.value));
  const next = Number.isFinite(parsed) ? Math.min(props.max, Math.max(props.min, parsed)) : value.value;
  input.value = String(next);
  value.value = next;
}
</script>

<template>
  <label class="number">
    <input type="number" :aria-label="label" :min="min" :max="max" :value="value" @change="commit" />
    <span>{{ unit }}</span>
  </label>
</template>

<style scoped>
.number {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dim);
}

input {
  width: 4.5em;
  padding: 6px 8px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky-raised);
  color: var(--starlight);
  font: inherit;
  text-align: right;
}

input:focus {
  border-color: var(--glow);
  outline: none;
}
</style>
