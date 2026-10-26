<script lang="ts" setup>
import { findRule, resolveToggles, type Profile } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import LevelPicker from '@/components/LevelPicker.vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';

defineProps<{ profile: Profile }>();
</script>

<template>
  <h2>Sites</h2>
  <p class="help">
    Tamed hides the distracting parts. Redirected sends you to a Lock In page you can get through for a few minutes.
    Restricted has no way through until the session ends.
  </p>
  <ul class="list sites">
    <li v-for="recipe in recipes" :key="recipe.id">
      <div class="site">
        <span class="name">{{ recipe.name }}</span>
        <LevelPicker
          :site-name="recipe.name"
          :can-tame="recipe.toggles.length > 0"
          :model-value="findRule(profile, recipe.id)?.level ?? 'allowed'"
          @update:model-value="setSiteLevel(profile.id, recipe.id, $event)"
        />
      </div>
      <div v-if="findRule(profile, recipe.id)?.level === 'tamed'" class="toggles">
        <ToggleSwitch
          v-for="toggle in recipe.toggles"
          :key="toggle.id"
          :label="toggle.label"
          :model-value="resolveToggles(recipe, findRule(profile, recipe.id))[toggle.id] ?? false"
          @update:model-value="setProfileToggle(profile.id, recipe.id, toggle.id, $event)"
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
