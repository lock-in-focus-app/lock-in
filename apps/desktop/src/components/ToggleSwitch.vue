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
    <span class="track" aria-hidden="true"><span class="thumb" /></span>
  </button>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 0;
  background: none;
  text-align: left;
}

.toggle:disabled {
  cursor: default;
  opacity: 0.5;
}

.track {
  flex: none;
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--sky-hover);
  transition: background 200ms;
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dim);
  transition:
    transform 450ms var(--spring),
    background 200ms;
}

[aria-checked='true'] .track {
  background: color-mix(in srgb, var(--glow) 35%, var(--sky-hover));
}

[aria-checked='true'] .thumb {
  transform: translateX(14px);
  background: var(--glow);
}

.toggle:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: 2px;
  border-radius: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .thumb {
    transition: none;
  }
}
</style>
