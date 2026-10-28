<script setup lang="ts">
import { addWeeks, maxConstellationNameLength } from '@lock-in/core';
import { computed, nextTick, ref } from 'vue';

// Explore, as the Observatory HUD's readout (PLAN Phase 5): the sky on its own, with readouts in
// the corners, a faint crosshair in the middle, a column of tools and a way out.
const props = defineProps<{
  starCount: number;
  stardust: number;
  weekCount: number;
  planetCount: number;
  zoom: number;
  /** The constellation in the crosshair, if any. */
  aimed?: { id: string; name: string; named: boolean; weekStart: number };
  thisWeek: number;
}>();
const emit = defineEmits<{
  zoom: [factor: number];
  recenter: [];
  rename: [id: string, name: string];
  done: [];
}>();

/** A count as a readout shows it, e.g. 03. */
const counted = (count: number) => String(count).padStart(2, '0');
const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const range = (week: number) => `${dateFormat.format(week)} – ${dateFormat.format(addWeeks(week, 1) - 1)}`;
/** How many weeks before this one the aimed constellation's is. */
const weeksBack = computed(() =>
  props.aimed ? Math.round((props.thisWeek - props.aimed.weekStart) / (7 * 24 * 60 * 60_000)) : undefined,
);

// Naming the constellation in the crosshair, in place of its readout.
const naming = ref<{ id: string; was: string; draft: string }>();
const nameInput = ref<HTMLInputElement>();
async function startNaming() {
  const aimed = props.aimed;
  if (!aimed) return;
  const was = aimed.named ? aimed.name : '';
  naming.value = { id: aimed.id, was, draft: was };
  await nextTick();
  nameInput.value?.focus();
}
function saveName() {
  const name = naming.value;
  if (!name) return;
  naming.value = undefined;
  if (name.draft.trim() !== name.was) emit('rename', name.id, name.draft);
}
</script>

<template>
  <div class="explore">
    <form v-if="naming" class="corner tl naming" @submit.prevent="saveName">
      <label class="mono" for="constellation-name">Name this constellation</label>
      <input
        id="constellation-name"
        ref="nameInput"
        v-model="naming.draft"
        class="card"
        :maxlength="maxConstellationNameLength"
        :placeholder="aimed?.name ?? 'A name'"
        autocomplete="off"
        @keydown.esc.stop.prevent="naming = undefined"
        @blur="saveName"
      />
    </form>
    <p v-else class="corner tl mono">
      <template v-if="aimed">
        <b>{{ aimed.name }}</b
        ><br />{{ range(aimed.weekStart) }}
      </template>
      <template v-else>Drag to look around<br />Scroll to zoom</template>
    </p>
    <p class="corner tr mono">
      Zoom <b>{{ zoom.toFixed(2) }}×</b><br />
      <template v-if="weeksBack === 0">This week</template>
      <template v-else-if="weeksBack !== undefined"
        >Week <b>−{{ weeksBack }}</b></template
      >
    </p>
    <p class="corner bl mono">
      Stars <b>{{ String(starCount).padStart(3, '0') }}</b
      ><br />Weeks <b>{{ counted(weekCount) }}</b>
    </p>
    <p class="corner br mono">
      Planets <b>{{ counted(planetCount) }}</b
      ><br />Stardust <b>{{ stardust.toLocaleString() }}</b>
    </p>
    <span class="cross" aria-hidden="true" />

    <div class="tools" aria-label="Explore tools" role="toolbar">
      <button class="card tool" type="button" title="Zoom in (+)" @click="emit('zoom', 1.6)">+</button>
      <button class="card tool" type="button" title="Zoom out (−)" @click="emit('zoom', 1 / 1.6)">−</button>
      <button class="card tool" type="button" title="Back to this week (0)" @click="emit('recenter')">⌖</button>
      <button
        class="card tool"
        type="button"
        :title="aimed ? `Name ${aimed.name}` : 'Name a constellation: put one in the crosshair first'"
        :disabled="!aimed"
        @click="startNaming"
      >
        ✎
      </button>
    </div>
    <button class="card exit mono" type="button" @click="emit('done')">Esc · Done exploring</button>
  </div>
</template>

<style scoped>
.explore {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

button,
input {
  pointer-events: auto;
}

p {
  margin: 0;
}

.corner {
  position: absolute;
}

.tl {
  top: 14px;
  left: 16px;
  max-width: 60%;
}

.tl b {
  color: var(--starlight);
}

.tr {
  top: 14px;
  right: 16px;
  text-align: right;
}

.bl {
  bottom: 16px;
  left: 16px;
}

.br {
  right: 16px;
  bottom: 16px;
  text-align: right;
}

.naming {
  display: grid;
  gap: 4px;
  width: 60%;
}

.naming input {
  padding: 6px 8px;
  border: 0;
  outline: 0;
  background: none;
  color: var(--starlight);
  font: 12px var(--mono);
  caret-color: #9fe3c9;
}

.naming input:focus {
  --t: rgb(220 228 255 / 0.85);
}

/* A faint crosshair in the middle, where zooming goes toward and naming points. */
.cross {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 34px;
  height: 34px;
  translate: -50% -50%;
  background:
    linear-gradient(var(--tick), var(--tick)) center / 1px 100% no-repeat,
    linear-gradient(var(--tick), var(--tick)) center / 100% 1px no-repeat;
  -webkit-mask-image: radial-gradient(circle, transparent 5px, #000 6px);
  mask-image: radial-gradient(circle, transparent 5px, #000 6px);
  opacity: 0.6;
}

.tools {
  position: absolute;
  top: 50%;
  right: 16px;
  translate: 0 -50%;
  display: grid;
  gap: 6px;
}

.tool {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  color: var(--dim);
  font: 13px var(--mono);
  transition: color 300ms;
}

.tool:disabled {
  opacity: 0.35;
  cursor: default;
}

.exit {
  position: absolute;
  bottom: 14px;
  left: 50%;
  translate: -50% 0;
  padding: 6px 11px;
  background: none;
  color: var(--dim);
  transition: color 300ms;
}

.tool:hover:not(:disabled),
.exit:hover {
  color: var(--starlight);
}
</style>
