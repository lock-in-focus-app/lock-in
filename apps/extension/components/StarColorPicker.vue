<script lang="ts" setup>
import { starPalette } from '@lock-in/core';
import { useId } from 'vue';

// The color of a profile's stars in the desktop app's night sky. The same picker is in the
// desktop app (apps/desktop/src/components/StarColorPicker.vue).
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
  gap: 4px;
}

.swatch {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
}

input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--star);
  box-shadow: 0 0 6px var(--star);
  transition: transform 300ms var(--spring);
}

.swatch:hover .dot {
  transform: scale(1.2);
}

input:checked + .dot {
  outline: 2px solid var(--star);
  outline-offset: 3px;
}

input:focus-visible + .dot {
  outline: 2px solid var(--starlight);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    transition: none;
  }
}
</style>
