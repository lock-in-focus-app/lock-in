<script lang="ts" setup>
import { findRule, ownSiteDomain, type Profile, type SiteRecipe } from '@lock-in/core';
import { computed } from 'vue';

// The parts of a site's page picked with the element picker, which open from the popup on the
// site itself. Each can be shown again, except during a Hard session of the profile.
const props = defineProps<{ profile: Profile; recipe: SiteRecipe; locked: boolean }>();

const rule = computed(() => findRule(props.profile, props.recipe.id));
const parts = computed(() => rule.value?.hidden ?? []);
const tamed = computed(() => rule.value?.level === 'tamed' || !!rule.value?.paths?.some((p) => p.level === 'tamed'));
</script>

<template>
  <div v-if="parts.length || (tamed && ownSiteDomain(recipe.id))" class="hidden-parts">
    <ul v-if="parts.length" class="list" :aria-label="`Hidden on ${recipe.name}`">
      <li v-for="part in parts" :key="part.selector">
        <span class="part" :title="part.selector">{{ part.label || part.selector }}</span>
        <button
          type="button"
          class="text-button"
          :disabled="locked"
          :aria-label="`Show ${part.label || part.selector} again`"
          @click="showPart(profile.id, recipe.id, part.selector)"
        >
          Show again
        </button>
      </li>
    </ul>
    <p class="help small">
      <template v-if="parts.length">Hidden whenever {{ profile.name }} tames {{ recipe.name }}. </template>
      To hide something else, open {{ recipe.name }} and choose Hide parts of this page in Lock In's popup.
    </p>
  </div>
</template>

<style scoped>
.hidden-parts {
  margin-top: 6px;
}

.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.part {
  overflow: hidden;
  color: var(--starlight);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.help {
  margin: 4px 0 0;
}
</style>
