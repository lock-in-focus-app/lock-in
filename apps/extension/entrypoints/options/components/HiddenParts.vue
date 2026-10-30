<script lang="ts" setup>
import { siteSettingsFor, type SiteRecipe } from '@lock-in/core';
import { computed } from 'vue';

// The parts of a site's page picked with the element picker, which opens from the popup on the
// site itself. They're hidden whenever the site is tamed, in a session or all the time. Each can
// be shown again, except during a Hard session.
const props = defineProps<{ recipe: SiteRecipe; locked: boolean }>();

const sites = useStorageItem(siteSettings);
const parts = computed(() => siteSettingsFor(sites.value ?? [], props.recipe.id)?.hidden ?? []);
</script>

<template>
  <div v-if="parts.length" class="hidden-parts">
    <p class="label">Hidden on the page</p>
    <ul class="list" :aria-label="`Hidden on ${recipe.name}`">
      <li v-for="part in parts" :key="part.selector">
        <span class="part" :title="part.selector">{{ part.label || part.selector }}</span>
        <button
          type="button"
          class="text-button"
          :disabled="locked"
          :aria-label="`Show ${part.label || part.selector} again`"
          @click="showPart(recipe.id, part.selector)"
        >
          Show again
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hidden-parts {
  margin-top: 8px;
}

.label {
  margin: 0;
  color: var(--faint);
  font: 10px/1.5 var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.part {
  overflow: hidden;
  min-width: 0;
  color: var(--starlight);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
