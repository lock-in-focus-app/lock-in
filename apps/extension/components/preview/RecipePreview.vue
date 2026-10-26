<script lang="ts" setup>
import { computed, provide, ref, toRef, watch } from 'vue';
import { previewKey } from './context';
import { mocks } from './mocks';
import './mock.css';

// A small drawing of a site that reacts to its recipe's toggles as they're flipped.

const props = defineProps<{
  recipeId: string;
  siteName: string;
  values: Record<string, boolean>;
  /** The toggle the user is pointing at, to outline what it hides. */
  highlight?: string;
}>();

const pages = computed(() => mocks[props.recipeId] ?? []);
const pageId = ref(pages.value[0]?.id);
const page = computed(() => pages.value.find((p) => p.id === pageId.value) ?? pages.value[0]);

// Pointing at a toggle that only matters on another page switches to that page.
watch(
  () => props.highlight,
  (toggle) => {
    if (!toggle || page.value?.toggles.includes(toggle)) return;
    const other = pages.value.find((p) => p.toggles.includes(toggle));
    if (other) pageId.value = other.id;
  },
);

provide(previewKey, { values: toRef(props, 'values'), highlight: toRef(props, 'highlight') });
</script>

<template>
  <figure v-if="page" class="preview">
    <div class="frame" role="img" :aria-label="`Preview of ${siteName} with these toggles`">
      <div class="chrome" aria-hidden="true">
        <span class="dot" /><span class="dot" /><span class="dot" />
        <span class="address">{{ page.address }}</span>
      </div>
      <div class="mock" :class="[recipeId, { grayscale: values.grayscale }]" aria-hidden="true">
        <component :is="page.component" />
      </div>
    </div>
    <figcaption v-if="pages.length > 1" class="page-tabs">
      <button
        v-for="p in pages"
        :key="p.id"
        type="button"
        :aria-pressed="p.id === page.id"
        :aria-label="`Show ${siteName} ${p.label} preview`"
        @click="pageId = p.id"
      >
        {{ p.label }}
      </button>
    </figcaption>
  </figure>
</template>

<style scoped>
.preview {
  margin: 4px 0 8px;
}

.frame {
  overflow: hidden;
  border: 1px solid var(--sky-hover);
  border-radius: 10px;
  background: var(--sky);
}

.chrome {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  background: var(--sky-hover);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sky-raised);
}

.address {
  margin-left: 8px;
  color: var(--dim);
  font-size: 10px;
}

.mock {
  height: 210px;
  overflow: hidden;
  transition: filter 400ms;
}

.mock.grayscale {
  filter: grayscale(1);
}

.page-tabs {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-top: 6px;
}

.page-tabs button {
  padding: 2px 10px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.page-tabs button[aria-pressed='true'] {
  background: var(--sky-hover);
  color: var(--starlight);
}

@media (prefers-reduced-motion: reduce) {
  .mock {
    transition: none;
  }
}
</style>
