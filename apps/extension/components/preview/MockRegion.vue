<script lang="ts" setup>
import { computed, inject } from 'vue';
import { previewKey } from './context';

// One part of a preview mock that a recipe toggle hides, e.g. the home feed. Hiding it
// collapses it with a spring, and everything after it slides up to fill the space.
const props = withDefaults(defineProps<{ toggle: string; axis?: 'y' | 'x' }>(), { axis: 'y' });
const preview = inject(previewKey)!;

const hidden = computed(() => !!preview.values.value[props.toggle]);
const highlighted = computed(() => preview.highlight.value === props.toggle);
</script>

<template>
  <div class="region" :class="[axis, { hidden, highlighted }]" :data-toggle="toggle">
    <div class="inner"><slot /></div>
  </div>
</template>

<style scoped>
.region {
  position: relative;
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 1fr;
  transition:
    grid-template-rows 550ms var(--spring),
    grid-template-columns 550ms var(--spring);
}

.inner {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 6px;
  transform-origin: top center;
  transition:
    transform 550ms var(--spring),
    opacity 250ms;
}

.region.hidden.y {
  grid-template-rows: 0fr;
}

.region.hidden.x {
  grid-template-columns: 0fr;
}

.region.hidden > .inner {
  opacity: 0;
  transform: scale(0.92);
}

/* Pointing at a toggle outlines what it hides. If it's hidden already, it comes back as a faint ghost. */
.region::after {
  position: absolute;
  /* Set by the drawing so the outline hugs what's drawn, not the spacing around it. */
  inset: var(--region-outline, -2px);
  border: 2px solid var(--glow);
  border-radius: 8px;
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms;
}

.region.highlighted::after {
  opacity: 1;
}

.region.hidden.highlighted::after {
  border-style: dashed;
}

.region.hidden.highlighted {
  grid-template-rows: 1fr;
  grid-template-columns: 1fr;
}

.region.hidden.highlighted > .inner {
  opacity: 0.3;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .region,
  .inner {
    transition: none;
  }
}
</style>
