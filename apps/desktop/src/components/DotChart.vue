<script setup lang="ts">
import { computed } from 'vue';

// A chart of dots for the weekly report: one block of dots per value, lit from the bottom up in
// proportion to the largest value. The largest gets a "Peak" pill above it, and hovering any
// column shows what it stands for in the same kind of pill.
const props = defineProps<{
  values: number[];
  /** What each column stands for, read out and shown on hover, e.g. "Wednesday: 1h 30m". */
  titles: string[];
  /** Short labels under the columns, if any. */
  labels?: string[];
  /** The pill above the largest value, e.g. "Peak: Wednesday". */
  peak?: string;
  rows: number;
  /** Dots across each column. */
  across?: number;
  color: string;
  label: string;
}>();

const perColumn = computed(() => props.rows * (props.across ?? 1));
const max = computed(() => Math.max(0, ...props.values));
const peakIndex = computed(() => (max.value > 0 ? props.values.indexOf(max.value) : -1));
const lit = (value: number) => (value > 0 ? Math.max(1, Math.round((value / max.value) * perColumn.value)) : 0);
/** Whether the dot at `index` (counted from the top left) is lit, filling from the bottom row up. */
function isLit(value: number, index: number) {
  const across = props.across ?? 1;
  const row = Math.floor(index / across);
  const fromBottom = (props.rows - 1 - row) * across + (index % across);
  return fromBottom < lit(value);
}
</script>

<template>
  <ol
    class="chart"
    :class="{ 'has-peak': peak }"
    :aria-label="label"
    :style="{ '--columns': values.length, '--across': across ?? 1, '--dot': color }"
  >
    <li v-for="(value, i) in values" :key="i" :class="{ peak: i === peakIndex }" tabindex="0">
      <span v-if="peak && i === peakIndex" class="pill peak-pill" aria-hidden="true">{{ peak }}</span>
      <span class="pill tip" aria-hidden="true">{{ titles[i] }}</span>
      <span class="dots">
        <span
          v-for="index in perColumn"
          :key="index"
          class="dot"
          :class="{ lit: isLit(value, index - 1) }"
          :style="{ '--row': Math.floor((index - 1) / (across ?? 1)) }"
        />
      </span>
      <span v-if="labels" class="axis" aria-hidden="true">{{ labels[i] }}</span>
      <span class="hidden">{{ titles[i] }}</span>
    </li>
  </ol>
</template>

<style scoped>
.chart {
  display: grid;
  grid-template-columns: repeat(var(--columns), 1fr);
  gap: 2px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.chart.has-peak {
  padding-top: 26px;
}

li {
  position: relative;
  display: grid;
  gap: 4px;
  justify-items: center;
  border-radius: 6px;
  outline: none;
}

.dots {
  display: grid;
  grid-template-columns: repeat(var(--across), 1fr);
  gap: 3px;
  width: 100%;
  max-width: calc(var(--across) * 11px);
}

.dot {
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.07);
}

.dot.lit {
  background: var(--dot);
  opacity: 0.55;
  animation: rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  /* The bottom rows light first. */
  animation-delay: calc((12 - var(--row)) * 35ms);
  transition: opacity 300ms;
}

.peak .dot.lit,
li:hover .dot.lit,
li:focus-visible .dot.lit {
  opacity: 1;
  box-shadow: 0 0 6px var(--dot);
}

.axis {
  color: var(--dim);
  font-size: 11px;
}

.pill {
  position: absolute;
  bottom: 100%;
  left: 50%;
  z-index: 1;
  margin-bottom: 4px;
  padding: 2px 8px;
  border: 1px solid rgb(205 215 255 / 0.14);
  border-radius: 999px;
  background: rgb(30 38 67 / 0.92);
  color: var(--starlight);
  font-size: 11px;
  white-space: nowrap;
  translate: -50% 0;
  pointer-events: none;
  transition: opacity 250ms;
}

.has-peak .pill {
  bottom: auto;
  top: -26px;
  margin-bottom: 0;
}

/* Keep the pills inside the card at either end. */
li:first-child .pill {
  left: 0;
  translate: 0 0;
}

li:last-child .pill {
  right: 0;
  left: auto;
  translate: 0 0;
}

.tip {
  opacity: 0;
}

li:hover .tip,
li:focus-visible .tip {
  opacity: 1;
}

/* Hovering any column hides the peak pill, so the two don't overlap. */
.chart:hover .peak-pill,
.chart:focus-within .peak-pill {
  opacity: 0;
}

@keyframes rise {
  from {
    opacity: 0;
    scale: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot.lit {
    animation: none;
  }
}

/* Read out by screen readers, in place of the dots. */
.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
