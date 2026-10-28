<script setup lang="ts">
import { starPalette } from '@lock-in/core';
import { useId } from 'vue';

// The color of a profile's stars in the night sky. The same picker is in the browser
// extension's settings (apps/extension/components/StarColorPicker.vue); this copy is styled for
// the desktop app's HUD.
defineProps<{ color: string; profileName: string }>();
const emit = defineEmits<{ 'update:color': [color: string] }>();
const group = useId();
</script>

<template>
  <div class="colors" role="radiogroup" :aria-label="`Star color for ${profileName}`">
    <label v-for="entry in starPalette" :key="entry.color" class="swatch" :title="entry.name">
      <input
        type="radio"
        :name="group"
        :value="entry.color"
        :checked="entry.color === color"
        :aria-label="entry.name"
        @change="emit('update:color', entry.color)"
      />
      <span class="dot" :style="{ '--star': entry.color }" aria-hidden="true" />
    </label>
  </div>
</template>

<style scoped>
.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* The picked color sits in a small frame with corner ticks in its color. */
.swatch {
  position: relative;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 300ms;
}

.swatch:has(input:checked) {
  --t: var(--star);
  border-color: var(--line);
  background:
    linear-gradient(var(--t), var(--t)) top left / 5px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) top left / 1px 5px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom right / 5px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom right / 1px 5px no-repeat;
}

input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--star);
  box-shadow: 0 0 8px var(--star);
  transition: transform 300ms var(--spring);
}

.swatch:hover .dot {
  transform: scale(1.25);
}

input:focus-visible + .dot {
  outline: 1px solid var(--starlight);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    transition: none;
  }
}
</style>
