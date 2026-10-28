<script lang="ts" setup>
import {
  findPathRule,
  findRule,
  isLooser,
  ownSiteDomain,
  resolveToggles,
  siteLevels,
  type Profile,
  type Session,
  type SiteLevel,
  type SiteRecipe,
} from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import LevelPicker from './LevelPicker.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{
  recipe: SiteRecipe;
  profiles: Profile[];
  session: Session | null;
  /** The current tab's path, for page rules. */
  path: string;
  /** The current tab, reloaded once it's kept away so the change shows straight away. */
  tabId?: number;
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
const showsToggles = computed(
  () => (pageRule.value?.level ?? rule.value?.level) === 'tamed' || rule.value?.level === 'tamed',
);
const values = computed(() => resolveToggles(props.recipe, rule.value, props.session?.overrides?.[props.recipe.id]));
const passMinutesLeft = computed(() => {
  const until = props.session?.passes?.[props.recipe.id] ?? 0;
  return until > Date.now() ? Math.ceil((until - Date.now()) / 60_000) : 0;
});
const hasSessionChanges = computed(() => Object.keys(props.session?.overrides?.[props.recipe.id] ?? {}).length > 0);

// A site someone added needs the browser's OK before Lock In can reach it. The browser only
// asks straight from a click, so asking comes before anything else in one.
const own = computed(() => !!ownSiteDomain(props.recipe.id));
const reach = useReachable(() => (own.value ? [props.recipe.name] : []));
const needsReach = computed(() => own.value && !!reach.value && !reach.value.has(props.recipe.name));
function askIfNeeded(level: SiteLevel) {
  if (level !== 'allowed' && needsReach.value) void askToReach([props.recipe.name]);
}

function setLevel(level: SiteLevel) {
  if (!profile.value) return;
  askIfNeeded(level);
  void setSiteLevel(profile.value.id, props.recipe.id, level);
}

// During a session, a site that's open can be kept away for the rest of it, and later ones.
// What the picked level does, spelled out under the picker.
const levelDetail = computed(() => {
  const level = rule.value?.level ?? 'allowed';
  if (level === 'tamed' && !props.recipe.toggles.length) return `Nothing to hide on ${props.recipe.name} yet.`;
  return siteLevels.find((l) => l.id === level)?.detail;
});

const isOpen = computed(() => !isLooser('tamed', rule.value?.level ?? 'allowed'));
const canKeepAway = computed(() => !!props.session && !!profile.value && !pageRule.value && isOpen.value);
async function keepAway(level: 'redirected' | 'restricted') {
  if (!profile.value) return;
  askIfNeeded(level);
  await setSiteLevel(profile.value.id, props.recipe.id, level);
  await syncRedirectsNow();
  if (props.tabId !== undefined) await browser.tabs.reload(props.tabId);
  window.close();
}

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
      @update:model-value="setLevel"
    />
    <p v-if="!session && profile" class="note detail">{{ levelDetail }}</p>

    <p v-if="pageRule" class="note">
      This page follows the {{ pageRule.path === '/' ? 'home page' : pageRule.path }} rule: {{ pageRule.level }}.
    </p>

    <template v-if="session && !pageRule">
      <p v-if="rule?.level === 'redirected'" class="note">
        {{ recipe.name }} is redirected in {{ profile?.name ?? 'this profile'
        }}<template v-if="passMinutesLeft"> · pass ends in {{ passMinutesLeft }} min</template>.
      </p>
      <p v-else-if="rule?.level === 'restricted'" class="note">
        {{ recipe.name }} is restricted in {{ profile?.name ?? 'this profile' }}, with no way through until the session
        ends.
      </p>
      <p v-else-if="rule?.level !== 'tamed'" class="note">
        {{ recipe.name }} {{ own ? 'is left alone' : "isn't tamed" }} in {{ profile?.name ?? 'this profile' }}.
      </p>
    </template>

    <div v-if="canKeepAway" class="keep-away">
      <span>Keep it away from now on</span>
      <button type="button" @click="keepAway('redirected')">Redirect it</button>
      <button type="button" @click="keepAway('restricted')">Restrict it</button>
    </div>

    <p v-if="needsReach && (rule?.level ?? 'allowed') !== 'allowed'" class="reach">
      <span>Lock In can't reach {{ recipe.name }} yet, so it's left alone for now.</span>
      <button type="button" class="save" @click="askToReach([recipe.name])">Let Lock In reach it</button>
    </p>

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
    <p v-else-if="canKeepAway" class="footer">
      <span>Either one is saved to {{ profile?.name }}, for later sessions too</span>
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

.detail {
  margin-bottom: 8px;
}

.levels {
  margin: 8px 0 6px;
  background: var(--sky-raised);
}

.note {
  margin: 0;
  line-height: 1.45;
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

/* Spelled out, two buttons side by side, during a session on a site that's open. */
.keep-away {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--dim);
  font-size: 12px;
}

.keep-away span {
  flex-basis: 100%;
}

.keep-away button {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--sky-raised);
  color: var(--starlight);
  font-size: 12px;
}

.keep-away button:hover {
  background: var(--sky-hover);
}

.reach {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  margin: 8px 0 0;
  color: var(--glow);
  font-size: 12px;
}
</style>
