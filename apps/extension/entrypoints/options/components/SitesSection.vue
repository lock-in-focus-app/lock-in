<script lang="ts" setup>
import { findRule, resolveToggles, type Profile } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { ref } from 'vue';
import LevelPicker from '@/components/LevelPicker.vue';
import RecipePreview from '@/components/preview/RecipePreview.vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';
import PageRules from './PageRules.vue';

const props = defineProps<{ profile: Profile }>();

// Toggles matter whenever any part of the site is tamed, even if only one page is.
const showsToggles = (recipeId: string) => {
  const rule = findRule(props.profile, recipeId);
  return rule?.level === 'tamed' || !!rule?.paths?.some((page) => page.level === 'tamed');
};

// The toggle being pointed at or focused, so the preview can outline what it hides.
const pointing = ref<{ recipeId: string; toggleId: string }>();
const point = (recipeId: string, toggleId?: string) => {
  pointing.value = toggleId ? { recipeId, toggleId } : undefined;
};
</script>

<template>
  <h2>Sites</h2>
  <p class="help">
    What happens to each site while {{ profile.name }} is running. Allowed leaves it alone. Tamed keeps it working but
    hides the distracting parts, which you pick below. Redirected sends you to a Lock In page first, with a way through
    for a few minutes. Restricted has no way through until the session ends. Page rules give part of a site its own
    level, like redirecting YouTube Shorts while the rest of YouTube is tamed.
  </p>
  <ul class="list sites">
    <li v-for="(recipe, i) in recipes" :key="recipe.id">
      <!-- The tour points at the first site's levels. -->
      <div class="site" :data-tour="i === 0 ? 'sites' : undefined">
        <span class="name">{{ recipe.name }}</span>
        <LevelPicker
          :site-name="recipe.name"
          :can-tame="recipe.toggles.length > 0"
          :model-value="findRule(profile, recipe.id)?.level ?? 'allowed'"
          @update:model-value="setSiteLevel(profile.id, recipe.id, $event)"
        />
      </div>
      <PageRules :profile="profile" :recipe="recipe" />
      <div v-if="showsToggles(recipe.id)" class="toggles">
        <RecipePreview
          :recipe-id="recipe.id"
          :site-name="recipe.name"
          :values="resolveToggles(recipe, findRule(profile, recipe.id))"
          :highlight="pointing?.recipeId === recipe.id ? pointing.toggleId : undefined"
        />
        <ToggleSwitch
          v-for="toggle in recipe.toggles"
          :key="toggle.id"
          :label="toggle.label"
          :model-value="resolveToggles(recipe, findRule(profile, recipe.id))[toggle.id] ?? false"
          @update:model-value="setProfileToggle(profile.id, recipe.id, toggle.id, $event)"
          @mouseenter="point(recipe.id, toggle.id)"
          @mouseleave="point(recipe.id)"
          @focus="point(recipe.id, toggle.id)"
          @blur="point(recipe.id)"
        />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.sites li {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--sky-raised);
}

.site {
  display: grid;
  grid-template-columns: 1fr minmax(0, 320px);
  align-items: center;
  gap: 12px;
}

.toggles {
  margin-top: 6px;
  padding: 2px 0 0 12px;
  border-left: 2px solid var(--sky-hover);
}

@media (max-width: 480px) {
  .site {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
