<script setup lang="ts">
import type { GlowColor } from '@lock-in/core';
import { useId } from 'vue';

// The glow colors unlocked so far, as swatches like the star color picker's (StarColorPicker.vue).
defineProps<{ glows: GlowColor[]; picked: string }>();
const emit = defineEmits<{ pick: [id: string] }>();
const group = useId();
</script>

<template>
  <div class="glows" role="radiogroup" aria-label="Glow color">
    <label v-for="glow in glows" :key="glow.id" class="swatch" :style="{ '--glow-c': glow.color }">
      <input
        type="radio"
        :name="group"
        :value="glow.id"
        :checked="glow.id === picked"
        :aria-label="glow.name"
        @change="emit('pick', glow.id)"
      />
      <span class="dot" aria-hidden="true" />
    </label>
  </div>
</template>

<style scoped>
.glows {
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
  --t: var(--glow-c);
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
  background: var(--glow-c);
  box-shadow: 0 0 8px var(--glow-c);
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
