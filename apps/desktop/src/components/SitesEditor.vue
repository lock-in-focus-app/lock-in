<script setup lang="ts">
import type { Profile, SiteLevel, SiteRecipe, SiteRule } from '@lock-in/core';
import {
  hasRoomForOwnSite,
  maxOwnSites,
  ownSiteDomain,
  ownSiteRecipe,
  siteFor,
  withSiteLevel,
  withSiteRemoved,
} from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, ref } from 'vue';
import SegmentedControl from './SegmentedControl.vue';

// A profile's sites, the same list as in the browser extension's settings: each built-in site,
// then any added by address, with its level. The extension does the taming and redirecting, and
// gets every change here through the link. What Tamed hides, and page rules, are set there.
const props = defineProps<{ sites: SiteRule[] }>();
const emit = defineEmits<{ 'update:sites': [sites: SiteRule[]] }>();

const own = computed(() =>
  props.sites.flatMap((site) => {
    const domain = ownSiteDomain(site.recipeId);
    return domain ? [ownSiteRecipe(domain)] : [];
  }),
);
const listed = computed(() => [...recipes, ...own.value]);
const ruleFor = (id: string) => props.sites.find((site) => site.recipeId === id);

const levelOptions = (recipe: SiteRecipe) => [
  { id: 'allowed' as const, label: 'Allowed', title: 'Left alone' },
  {
    id: 'tamed' as const,
    label: 'Tamed',
    title: 'The distracting parts are hidden',
    disabled: recipe.toggles.length === 0 && ruleFor(recipe.id)?.level !== 'tamed',
  },
  {
    id: 'redirected' as const,
    label: 'Redirected',
    title: 'Sent to a Lock In page you can get through for a few minutes',
  },
  { id: 'restricted' as const, label: 'Restricted', title: 'Blocked, with no way through until the session ends' },
];

// The edits are the extension's own (packages/core), on this profile's sites alone.
const edit = (change: (list: Profile[]) => Profile[]) =>
  emit('update:sites', change([{ id: 'this', name: '', sites: props.sites }])[0]!.sites);
const setLevel = (recipeId: string, level: SiteLevel) => edit((list) => withSiteLevel(list, 'this', recipeId, level));
const remove = (recipeId: string) => edit((list) => withSiteRemoved(list, 'this', recipeId));

const pageCount = (id: string) => ruleFor(id)?.paths?.length ?? 0;

// Adding a site by its address. One that's built in is already listed.
const draft = ref('');
const found = computed(() => (draft.value.trim() ? siteFor(recipes, draft.value) : undefined));
const problem = computed(() => {
  if (!draft.value.trim()) return '';
  const site = found.value;
  if (!site) return "Use a site's address, like example.com.";
  if (!ownSiteDomain(site.id)) return `${site.name} is built in, so it's listed already.`;
  if (ruleFor(site.id)) return `${site.name} is listed already.`;
  if (!hasRoomForOwnSite({ id: 'this', name: '', sites: props.sites })) {
    return `A profile can have up to ${maxOwnSites} sites of its own.`;
  }
  return '';
});
function add() {
  const site = found.value;
  if (!site || problem.value) return;
  setLevel(site.id, 'redirected');
  draft.value = '';
}
</script>

<template>
  <div class="editor">
    <ul class="sites">
      <li v-for="recipe in listed" :key="recipe.id">
        <span class="name">
          {{ recipe.name }}
          <span v-if="pageCount(recipe.id)" class="pages mono">
            + {{ pageCount(recipe.id) }} page {{ pageCount(recipe.id) === 1 ? 'rule' : 'rules' }}
          </span>
        </span>
        <SegmentedControl
          class="levels"
          :label="`What happens to ${recipe.name}`"
          :options="levelOptions(recipe)"
          :model-value="ruleFor(recipe.id)?.level ?? 'allowed'"
          @update:model-value="setLevel(recipe.id, $event)"
        />
        <button
          v-if="ownSiteDomain(recipe.id)"
          class="key"
          type="button"
          :title="`Remove ${recipe.name}`"
          :aria-label="`Remove ${recipe.name}`"
          @click="remove(recipe.id)"
        >
          ×
        </button>
        <span v-else class="spacer" aria-hidden="true" />
      </li>
    </ul>

    <form class="add" @submit.prevent="add">
      <input
        v-model="draft"
        class="card"
        maxlength="253"
        placeholder="Add a site, like example.com"
        aria-label="Add a site"
      />
      <button class="card mono" type="submit" :disabled="!draft.trim() || !!problem">+ Add</button>
    </form>
    <p v-if="problem" class="problem">{{ problem }}</p>

    <p class="help">
      How each site is treated while this profile runs, in the browser with Lock In's extension. Added sites start out
      redirected, and the browser asks once to let Lock In reach each one. What Tamed hides, and page rules, are set in
      the extension's settings.
    </p>
  </div>
</template>

<style scoped>
.editor {
  padding: 6px 0 10px;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.sites li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 272px 22px;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pages {
  display: block;
  font-size: 9.5px;
}

.levels :deep(button) {
  padding: 5px 2px;
  font-size: 9px;
}

.key {
  padding: 2px 0;
}

.add {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

input {
  flex: 1;
  min-width: 0;
  padding: 7px 9px;
  border: 0;
  outline: 0;
  background: none;
  color: var(--starlight);
  font: 12px var(--mono);
}

input:focus {
  --t: var(--tick-bright);
}

.add button {
  padding: 6px 10px;
  background: none;
  color: var(--dim);
  transition: color 300ms;
}

.add button:not(:disabled):hover {
  color: var(--starlight);
}

.add button:disabled {
  cursor: default;
  opacity: 0.5;
}

.problem {
  margin: 6px 0 0;
  color: var(--glint);
  font-size: 11.5px;
}

.help {
  margin: 10px 0 0;
  color: var(--faint);
  font-size: 11.5px;
}

@media (max-width: 440px) {
  .sites li {
    grid-template-columns: minmax(0, 1fr) 22px;
  }

  .levels {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
