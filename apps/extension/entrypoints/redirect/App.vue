<script lang="ts" setup>
import {
  attemptsToday,
  findRecipe,
  parseHttpUrl,
  pickDestination,
  pickLink,
  redirectSettingsFor,
  siteAccess,
  siteRecipes,
  waitSecondsFor,
  type RedirectDestination,
  type RedirectSettings,
  type SavedLink,
  type SiteRecipe,
  type WhyReason,
} from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import BlockedCard from './components/BlockedCard.vue';
import IntentionGate from './components/IntentionGate.vue';
import LinkCard from './components/LinkCard.vue';
import QuoteCard from './components/QuoteCard.vue';
import StuckPage from './components/StuckPage.vue';
import WhyTap from './components/WhyTap.vue';

// The URL the user was heading to comes after the #. "?expired" means the tab was sent
// back here because its pass ran out, rather than the user trying to visit again.
// Which site it is comes from the profiles too, for sites people added themselves.
const target = parseHttpUrl(location.hash.slice(1));
const recipe = shallowRef<SiteRecipe>();
const looked = ref(false);
const expired = new URLSearchParams(location.search).has('expired');

const ready = ref(false);
const profileName = ref('');
const settings = ref<RedirectSettings>();
const destination = ref<RedirectDestination | 'blocked'>('gate');
const link = ref<SavedLink>();
const attempts = ref(0);
const visitId = ref('');
const why = ref<WhyReason>();

const siteName = computed(() => recipe.value?.name ?? '');
const destinationText = computed(() => (target ? `${target.hostname.replace(/^www\./, '')}${target.pathname}` : ''));
const badge = computed(() => {
  if (expired) return `Your pass for ${siteName.value} ran out`;
  return attempts.value <= 1
    ? `First try at ${siteName.value} today`
    : `${ordinal(attempts.value)} try at ${siteName.value} today`;
});
// A tab sent back after its pass counts as the next attempt for the wait.
const waitSeconds = computed(() =>
  settings.value ? waitSecondsFor(settings.value.gate, expired ? attempts.value + 1 : attempts.value) : 0,
);

onMounted(async () => {
  if (!target) return;

  const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
  const site = findRecipe(siteRecipes(recipes, profileList), target);
  recipe.value = site;
  looked.value = true;
  if (!site) return;
  const profile = profileList.find((p) => p.id === session?.profileId);
  const access = siteAccess({
    session,
    profiles: profileList,
    recipeId: site.id,
    path: target.pathname,
    now: Date.now(),
  });

  if (!profile || access === 'open') {
    // The session ended or a pass started since this tab was sent here. Make sure the
    // redirect rules have caught up, then carry on to the site.
    await syncRedirectsNow();
    location.replace(target.href);
    return;
  }

  profileName.value = profile.name;
  settings.value = redirectSettingsFor(profile);

  if (access === 'restricted') {
    destination.value = 'blocked';
    visitId.value = await recordGateVisit(site.id, 'blocked');
  } else if (!expired) {
    destination.value = pickDestination(settings.value);
    link.value = destination.value === 'link' ? pickLink(settings.value.links) : undefined;
    visitId.value = await recordGateVisit(site.id, destination.value);
  }
  attempts.value = attemptsToday(await gateVisits.getValue(), site.id, Date.now());
  ready.value = true;
});

watch(why, (value) => {
  if (visitId.value) void setVisitWhy(visitId.value, value);
});

async function proceed(intention: string) {
  const site = recipe.value;
  if (!target || !site) return;
  const id = visitId.value || (await recordGateVisit(site.id, 'gate'));
  await continueToSite(id, site.id, intention);
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

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
}
</script>

<template>
  <main>
    <p class="brand">
      <span class="star" aria-hidden="true">✦</span> Lock In<template v-if="profileName"> · {{ profileName }}</template>
    </p>

    <template v-if="ready && settings">
      <p class="badge">{{ badge }}</p>

      <IntentionGate
        v-if="destination === 'gate'"
        :site-name="siteName"
        :wait-seconds="waitSeconds"
        :require-reason="settings.gate.requireReason"
        :pass-minutes="settings.gate.passMinutes"
        @back="backToFocus"
        @continue="proceed"
      >
        <p class="destination" :title="target?.href">{{ destinationText }}</p>
      </IntentionGate>
      <QuoteCard v-else-if="destination === 'quote'" @back="backToFocus" />
      <LinkCard v-else-if="destination === 'link' && link" :link="link" />
      <BlockedCard
        v-else-if="destination === 'blocked'"
        :site-name="siteName"
        :profile-name="profileName"
        @back="backToFocus"
      />
      <StuckPage v-else @back="backToFocus" />

      <footer>
        <WhyTap v-if="visitId" v-model="why" />
        <div class="more">
          <button
            v-if="why === 'stuck' && destination !== 'stuck'"
            type="button"
            class="quiet"
            @click="destination = 'stuck'"
          >
            Stuck? Try a 2-minute unstick
          </button>
          <button
            v-if="destination !== 'gate' && destination !== 'blocked'"
            type="button"
            class="quiet still-need"
            @click="destination = 'gate'"
          >
            Still need {{ siteName }}?
          </button>
        </div>
      </footer>
    </template>

    <template v-else-if="!target || (looked && !recipe)">
      <h1>Nothing to open here</h1>
      <button type="button" class="primary" @click="backToFocus">Back to focus</button>
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

.badge {
  align-self: flex-start;
  margin: 0 0 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--sky-raised);
  color: var(--glow);
  font-size: 12px;
}

.destination {
  overflow: hidden;
  margin: 8px 0 24px;
  color: var(--dim);
  text-overflow: ellipsis;
  white-space: nowrap;
}

h1 {
  margin: 0 0 24px;
  font-size: 28px;
  font-weight: 500;
}

footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--sky-raised);
}

.more {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.more:empty {
  display: none;
}
</style>
