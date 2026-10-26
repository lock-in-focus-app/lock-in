<script lang="ts" setup>
import { findPathRule, findRule, resolveToggles, type Profile, type Session, type SiteRecipe } from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import LevelPicker from './LevelPicker.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{
  recipe: SiteRecipe;
  profiles: Profile[];
  session: Session | null;
  /** The current tab's path, for page rules. */
  path: string;
}>();

// Outside a session there's no "current" profile, so let the user pick which one to edit.
// Default to the first profile that has a rule for this site.
const editingId = ref(props.profiles.find((p) => findRule(p, props.recipe.id))?.id ?? props.profiles[0]?.id);
watch(
  () => props.profiles,
  (list) => {
    if (!list.some((p) => p.id === editingId.value)) editingId.value = list[0]?.id;
  },
);

const profile = computed(() =>
  props.profiles.find((p) => p.id === (props.session ? props.session.profileId : editingId.value)),
);
const rule = computed(() => findRule(profile.value, props.recipe.id));
const pageRule = computed(() => findPathRule(rule.value?.paths, props.path));
// Toggles show whenever this page, or the site as a whole, is tamed.
const showsToggles = computed(() => (pageRule.value?.level ?? rule.value?.level) === 'tamed' || rule.value?.level === 'tamed');
const values = computed(() => resolveToggles(props.recipe, rule.value, props.session?.overrides?.[props.recipe.id]));
const passMinutesLeft = computed(() => {
  const until = props.session?.passes?.[props.recipe.id] ?? 0;
  return until > Date.now() ? Math.ceil((until - Date.now()) / 60_000) : 0;
});
const hasSessionChanges = computed(
  () => Object.keys(props.session?.overrides?.[props.recipe.id] ?? {}).length > 0,
);

function set(toggleId: string, value: boolean) {
  if (props.session) {
    void setSessionToggle(props.recipe, toggleId, value);
  } else if (profile.value) {
    void setProfileToggle(profile.value.id, props.recipe.id, toggleId, value);
  }
}
</script>

<template>
  <section class="site">
    <p class="heading">On this site · {{ recipe.name }}</p>

    <label v-if="!session && profiles.length > 1" class="picker">
      <span>Editing</span>
      <select v-model="editingId">
        <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </label>

    <!-- Levels can be changed between sessions. Mid-session loosening waits for strictness levels. -->
    <LevelPicker
      v-if="!session && profile"
      class="levels"
      :site-name="recipe.name"
      :can-tame="recipe.toggles.length > 0"
      :model-value="rule?.level ?? 'allowed'"
      @update:model-value="setSiteLevel(profile.id, recipe.id, $event)"
    />

    <p v-if="pageRule" class="note">
      This page follows the {{ pageRule.path === '/' ? 'home page' : pageRule.path }} rule: {{ pageRule.level }}.
    </p>

    <template v-if="session && !pageRule">
      <p v-if="rule?.level === 'redirected'" class="note">
        {{ recipe.name }} is redirected in {{ profile?.name ?? 'this profile' }}<template v-if="passMinutesLeft">
          · pass ends in {{ passMinutesLeft }} min</template>.
      </p>
      <p v-else-if="rule?.level === 'restricted'" class="note">
        {{ recipe.name }} is restricted in {{ profile?.name ?? 'this profile' }}, with no way through until the session ends.
      </p>
      <p v-else-if="rule?.level !== 'tamed'" class="note">
        {{ recipe.name }} isn't tamed in {{ profile?.name ?? 'this profile' }}.
      </p>
    </template>

    <ToggleSwitch
      v-for="toggle in showsToggles ? recipe.toggles : []"
      :key="toggle.id"
      :label="toggle.label"
      :model-value="values[toggle.id] ?? false"
      @update:model-value="set(toggle.id, $event)"
    />

    <p v-if="session && hasSessionChanges" class="footer">
      <span>Changed for this session</span>
      <button type="button" class="save" @click="saveSessionChanges(recipe.id)">Save to {{ profile?.name }}</button>
    </p>
    <p v-else-if="!session" class="footer">
      <span>Applies whenever {{ profile?.name }} is running</span>
    </p>
  </section>
</template>

<style scoped>
.site {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--sky-hover);
}

.heading {
  margin: 0 0 4px;
  color: var(--dim);
  font-size: 12px;
}

.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  color: var(--dim);
  font-size: 12px;
}

select {
  font: inherit;
  color: var(--starlight);
  background: var(--sky-raised);
  border: 1px solid var(--sky-hover);
  border-radius: 6px;
  padding: 2px 6px;
}

.levels {
  margin: 6px 0 4px;
  background: var(--sky-raised);
}

.note {
  margin: 0;
  color: var(--dim);
  font-size: 12px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0 0;
  color: var(--dim);
  font-size: 12px;
}

.save {
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--sky-raised);
  color: var(--glow);
  font-size: 12px;
}

.save:hover {
  background: var(--sky-hover);
}
</style>
