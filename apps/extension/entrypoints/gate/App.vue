<script lang="ts" setup>
import { attemptsToday, findRecipe, findRule, gateDefaults, hasPass } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, onMounted, onUnmounted, ref } from 'vue';

// The redirect rule puts the URL the user was heading to after the #.
const target = parseTarget(location.hash.slice(1));
const recipe = target ? findRecipe(recipes, target) : undefined;

const ready = ref(false);
const profileName = ref('');
const attempts = ref(0);
const intention = ref('');
const remaining = ref<number>(gateDefaults.waitSeconds);
const continuing = ref(false);
let visitId = '';

const destination = computed(() => (target ? `${target.hostname.replace(/^www\./, '')}${target.pathname}` : ''));
const attemptText = computed(() =>
  attempts.value <= 1 ? `First try at ${recipe?.name} today` : `${ordinal(attempts.value)} try at ${recipe?.name} today`,
);

onMounted(async () => {
  if (!target || !recipe) return;

  const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
  const profile = profileList.find((p) => p.id === session?.profileId);
  const stillRedirected = findRule(profile, recipe.id)?.level === 'redirected' && !hasPass(session, recipe.id, Date.now());

  if (!session || !profile || !stillRedirected) {
    // The session ended or a pass started since this tab was sent here. Make sure the
    // redirect rules have caught up, then carry on to the site.
    await syncRedirectsNow();
    location.replace(target.href);
    return;
  }

  profileName.value = profile.name;
  visitId = await recordGateVisit(recipe.id);
  attempts.value = attemptsToday(await gateVisits.getValue(), recipe.id, Date.now());
  ready.value = true;
});

// The countdown only runs while the tab is in view, so switching away doesn't skip it.
const tick = setInterval(() => {
  if (ready.value && remaining.value > 0 && document.visibilityState === 'visible') remaining.value--;
}, 1000);
onUnmounted(() => clearInterval(tick));

async function proceed() {
  if (!target || !recipe || remaining.value > 0 || continuing.value) return;
  continuing.value = true;
  await continueToSite(visitId, recipe.id, intention.value);
  location.replace(target.href);
}

async function backToFocus() {
  if (history.length > 1) {
    history.back();
    return;
  }
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
}

function parseTarget(raw: string): URL | undefined {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
}
</script>

<template>
  <main>
    <p class="brand"><span class="star" aria-hidden="true">✦</span> Lock In<template v-if="profileName"> · {{ profileName }}</template></p>

    <template v-if="ready">
      <p class="attempts">{{ attemptText }}</p>
      <h1>What did you come here for?</h1>
      <p class="destination" :title="target?.href">{{ destination }}</p>

      <textarea
        v-model="intention"
        aria-label="What you came here for"
        placeholder="I'm here to…"
        rows="2"
        :maxlength="gateDefaults.maxIntentionLength"
        autofocus
        @keydown.enter.exact.prevent="proceed"
      />

      <div class="actions">
        <button type="button" class="back" @click="backToFocus">Back to focus</button>
        <button type="button" class="continue" :disabled="remaining > 0 || continuing" @click="proceed">
          <span class="fill" :style="{ transform: `scaleX(${1 - remaining / gateDefaults.waitSeconds})` }" />
          <span class="text">{{ remaining > 0 ? `Continue in ${remaining}s` : `Continue to ${recipe?.name}` }}</span>
        </button>
      </div>
      <p class="hint">Continuing gives you {{ gateDefaults.passMinutes }} minutes on {{ recipe?.name }}.</p>
    </template>

    <template v-else-if="!target || !recipe">
      <h1>Nothing to open here</h1>
      <button type="button" class="back" @click="backToFocus">Back to focus</button>
    </template>
  </main>
</template>

<style scoped>
main {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 460px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 32px 16px;
}

.brand {
  margin: 0 0 40px;
  color: var(--dim);
  font-size: 13px;
}

.star {
  color: var(--glow);
}

.attempts {
  align-self: flex-start;
  margin: 0 0 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--sky-raised);
  color: var(--glow);
  font-size: 12px;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
  line-height: 1.2;
}

.destination {
  overflow: hidden;
  margin: 8px 0 24px;
  color: var(--dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--sky-hover);
  border-radius: 10px;
  background: var(--sky-raised);
  color: var(--starlight);
  font: inherit;
  font-size: 15px;
  resize: none;
}

textarea:focus {
  border-color: var(--glow);
  outline: none;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
}

.back,
.continue {
  padding: 12px;
  transition: background 150ms, transform 150ms;
}

.back {
  background: var(--glow);
  color: var(--sky);
  font-weight: 600;
}

.back:hover {
  filter: brightness(1.08);
}

.continue {
  position: relative;
  overflow: hidden;
  background: var(--sky-raised);
}

.continue:not(:disabled):hover {
  background: var(--sky-hover);
}

.continue:disabled {
  color: var(--dim);
  cursor: default;
}

.back:active,
.continue:not(:disabled):active {
  transform: scale(0.98);
}

/* Fills up as the countdown runs. */
.fill {
  position: absolute;
  inset: 0;
  background: var(--sky-hover);
  transform-origin: left;
  transition: transform 1s linear;
}

.continue:not(:disabled) .fill {
  opacity: 0;
}

.text {
  position: relative;
}

.hint {
  margin: 12px 0 0;
  color: var(--dim);
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .fill,
  .back,
  .continue {
    transition: none;
  }
}
</style>
