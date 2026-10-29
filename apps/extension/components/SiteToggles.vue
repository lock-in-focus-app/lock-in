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
  if (level === 'tamed' && own.value) {
    const count = rule.value?.hidden?.length ?? 0;
    return count
      ? `Stays open, with the ${count === 1 ? 'part' : `${count} parts`} you picked hidden.`
      : `Stays open. Pick the parts of ${props.recipe.name} to hide below.`;
  }
  return siteLevels.find((l) => l.id === level)?.detail;
});

// The element picker hides parts of the page while the site is tamed. It runs on the page itself,
// through the content script, which a tab opened before Lock In could reach the site doesn't have
// yet, so it's added then.
const canPick = computed(
  () => !!profile.value && rule.value?.level === 'tamed' && props.tabId !== undefined && !needsReach.value,
);
async function pickParts() {
  if (!profile.value || props.tabId === undefined) return;
  const message = { type: 'lock-in:pick', profileId: profile.value.id, recipeId: props.recipe.id };
  try {
    await browser.tabs.sendMessage(props.tabId, message);
  } catch {
    await browser.scripting.executeScript({ target: { tabId: props.tabId }, files: ['/content-scripts/content.js'] });
    await browser.tabs.sendMessage(props.tabId, message);
  }
  window.close();
}

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
  <section class="card site">
    <p class="mono heading">
      On this site · <b>{{ recipe.name }}</b>
    </p>

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
      :can-tame="recipe.toggles.length > 0 || own"
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
      <button class="key" type="button" @click="keepAway('redirected')">Redirect it</button>
      <button class="key" type="button" @click="keepAway('restricted')">Restrict it</button>
    </div>

    <p v-if="needsReach && (rule?.level ?? 'allowed') !== 'allowed'" class="reach">
      <span>Lock In can't reach {{ recipe.name }} yet, so it's left alone for now.</span>
      <button type="button" class="key lit save" @click="askToReach([recipe.name])">Let Lock In reach it</button>
    </p>

    <ToggleSwitch
      v-for="toggle in showsToggles ? recipe.toggles : []"
      :key="toggle.id"
      :label="toggle.label"
      :model-value="values[toggle.id] ?? false"
      @update:model-value="set(toggle.id, $event)"
    />

    <div v-if="canPick" class="pick">
      <button type="button" class="key" @click="pickParts">Hide parts of this page</button>
      <span v-if="rule?.hidden?.length">
        {{ rule.hidden.length }} {{ rule.hidden.length === 1 ? 'part' : 'parts' }} hidden so far
      </span>
    </div>

    <p v-if="session && hasSessionChanges" class="footer">
      <span>Changed for this session</span>
      <button type="button" class="key lit save" @click="saveSessionChanges(recipe.id)">
        Save to {{ profile?.name }}
      </button>
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
/* The site the tab is on, in a frame of its own below the session. */
.site {
  margin-top: 14px;
  padding: 11px 12px 12px;
}

.heading {
  margin: 0 0 6px;
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
  padding: 3px 6px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgb(8 11 22 / 0.7);
  color: var(--starlight);
  font: inherit;
}

.levels {
  margin: 8px 0 6px;
}

.detail {
  margin-bottom: 6px;
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
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
  color: var(--faint);
  font-size: 11.5px;
}

/* Spelled out, two keys side by side, during a session on a site that's open. */
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

.keep-away .key {
  flex: 1;
  padding: 7px 8px;
}

/* Opens the element picker on the page, under the toggles. */
.pick {
  display: grid;
  gap: 4px;
  margin-top: 8px;
  color: var(--faint);
  font-size: 11.5px;
}

.pick .key {
  padding: 7px 10px;
}

.reach {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 8px;
  margin: 8px 0 0;
  color: var(--glow);
  font-size: 12px;
}
</style>
