<script lang="ts" setup>
import { siteLevels, type SiteLevel } from '@lock-in/core';
import { computed } from 'vue';

const props = defineProps<{
  /** The site's name, for screen readers. */
  siteName: string;
  /** Tamed does nothing for sites whose recipe has no toggles yet. */
  canTame: boolean;
}>();
const level = defineModel<SiteLevel>({ required: true });

const levels = computed(() =>
  siteLevels.map((level) =>
    level.id === 'tamed' && !props.canTame ? { ...level, detail: `Nothing to hide on ${props.siteName} yet.` } : level,
  ),
);
const index = computed(() => levels.value.findIndex((l) => l.id === level.value));
</script>

<template>
  <div class="levels" role="radiogroup" :aria-label="`${siteName} level`">
    <span class="indicator" aria-hidden="true" :style="{ transform: `translateX(${index * 100}%)` }" />
    <button
      v-for="option in levels"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="level === option.id"
      :class="option.id"
      :title="option.detail"
      :disabled="option.id === 'tamed' && !canTame && level !== 'tamed'"
      @click="level = option.id"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.levels {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 3px;
  border-radius: 9px;
  background: var(--sky);
}

/* Slides under the chosen level. */
.indicator {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc((100% - 6px) / 4);
  border-radius: 7px;
  background: var(--sky-hover);
  transition: transform 450ms var(--spring);
}

button {
  position: relative;
  padding: 5px 4px;
  background: none;
  color: var(--dim);
  font-size: 12px;
  transition: color 150ms;
}

button[aria-checked='true'] {
  color: var(--starlight);
}

button.restricted[aria-checked='true'] {
  color: var(--glow);
}

button:not(:disabled):hover {
  color: var(--starlight);
}

button:disabled {
  cursor: default;
  opacity: 0.4;
}

button:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: -2px;
  border-radius: 7px;
}

@media (prefers-reduced-motion: reduce) {
  .indicator {
    transition: none;
  }
}
</style>
