<script lang="ts" setup>
defineProps<{ label: string; disabled?: boolean }>();
const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <button
    class="toggle"
    type="button"
    role="switch"
    :aria-checked="checked"
    :disabled="disabled"
    @click="checked = !checked"
  >
    <span class="label">{{ label }}</span>
    <span class="state mono" aria-hidden="true">{{ checked ? 'On' : 'Off' }}</span>
    <span class="track" aria-hidden="true" />
  </button>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
  background: none;
  font-size: 12.5px;
  text-align: left;
}

.label {
  flex: 1;
}

.toggle:disabled {
  cursor: default;
  opacity: 0.5;
}

/* A small square track with a glowing dot that slides across. */
.track {
  flex: none;
  position: relative;
  width: 30px;
  height: 14px;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: 2px;
  transition: border-color 400ms;
}

.track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--faint);
  transition:
    translate 400ms var(--ease),
    background 400ms,
    box-shadow 400ms;
}

[aria-checked='true'] .track {
  border-color: rgb(159 227 201 / 0.4);
}

[aria-checked='true'] .track::after {
  translate: 16px 0;
  background: #9fe3c9;
  box-shadow: 0 0 8px #9fe3c9;
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .track::after {
    transition: none;
  }
}
</style>
