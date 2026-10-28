<script lang="ts" setup>
import {
  endLock,
  findRecipe,
  formatClock,
  timerStatus,
  type Profile,
  type Satellite,
  type SiteRecipe,
} from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, onUnmounted, ref } from 'vue';
import EndEarly from '@/components/EndEarly.vue';
import SatelliteLaunch from '@/components/SatelliteLaunch.vue';
import SatellitesBack from '@/components/SatellitesBack.vue';
import SatellitesView from '@/components/SatellitesView.vue';
import SiteToggles from '@/components/SiteToggles.vue';

const session = useStorageItem(activeSession);
const profileList = useStorageItem(profiles);
const linked = useStorageItem(desktopLinked);
const satelliteList = useStorageItem(satellites);
const offeredTour = useStorageItem(tourOffered);

// Satellites the extension keeps itself. Linked to the app, they go to it straight away.
const byState = (state: Satellite['state']) => (satelliteList.value ?? []).filter((s) => s.state === state);
const back = computed(() => byState('back'));
const orbiting = computed(() => byState('orbiting'));
const tasks = computed(() => byState('task'));
const done = computed(() => byState('done').sort((a, b) => b.stateAt - a.stateAt));

const activeProfile = computed(() => profileList.value?.find((p) => p.id === session.value?.profileId));

// activeTab lets the popup read the current tab's URL when the user opens it.
const siteRecipe = ref<SiteRecipe>();
const sitePath = ref('/');
void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab?.url) return;
  siteRecipe.value = findRecipe(recipes, tab.url);
  sitePath.value = new URL(tab.url).pathname;
});

// Ticks once a second, only while the popup is open.
const now = ref(Date.now());
const tick = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => clearInterval(tick));

// Sessions run by the desktop app have its quiet timer; the rest just count up.
const elapsed = computed(() => {
  if (!session.value) return '';
  const status = timerStatus(session.value, now.value);
  if (status.state === 'running') return formatClock(status.remainingMs);
  if (status.state === 'none') return formatClock(status.elapsedMs);
  const since = Math.floor(status.sinceMs / 60_000);
  return session.value.timer?.showSinceDone && since >= 1 ? `Done · ${since} min ago` : 'Done';
});

// Sessions from the desktop app can have a strictness, which applies until the timer is done.
const lock = computed(() => (session.value ? endLock(session.value, now.value) : undefined));
const endingEarly = ref(false);
function requestEnd() {
  if (lock.value) endingEarly.value = true;
  else void endSession();
}

function openSettings() {
  void browser.runtime.openOptionsPage();
  window.close();
}

// The tour for new users runs on the settings page, which it opens. The popup offers it once.
async function takeTour() {
  await tourOffered.setValue(true);
  await browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#tour` });
  window.close();
}

function start(profile: Profile) {
  now.value = Date.now();
  void startSession(profile.id);
}
</script>

<template>
  <main>
    <header>
      <span class="star" aria-hidden="true">✦</span>
      <h1>Lock In</h1>
      <span v-if="linked" class="linked" title="Sessions stay in step with the Lock In app">App linked</span>
      <button class="settings" type="button" @click="openSettings">Settings</button>
    </header>

    <section v-if="session" class="active">
      <p class="label">Locked in · {{ activeProfile?.name ?? 'Unknown profile' }}</p>
      <p class="elapsed" :class="{ done: elapsed.startsWith('Done') }">{{ elapsed }}</p>
      <EndEarly v-if="endingEarly && lock" :lock="lock" @end="endSession()" @cancel="endingEarly = false" />
      <button v-else class="end" type="button" @click="requestEnd">End session</button>
      <SatelliteLaunch
        class="satellites"
        session-running
        :in-orbit="orbiting.length"
        :linked="!!linked"
        compact
        autofocus
      />
    </section>

    <!-- Only once storage says there's no session, so a running one doesn't flash this first. -->
    <template v-else-if="session === null && profileList">
      <div v-if="offeredTour === false" class="offer">
        <p><span class="star" aria-hidden="true">✦</span> New here? A quick tour of what Lock In does.</p>
        <span class="offer-buttons">
          <button class="take" type="button" @click="takeTour">Take the tour</button>
          <button type="button" @click="tourOffered.setValue(true)">No thanks</button>
        </span>
      </div>
      <SatellitesBack v-if="back.length" :satellites="back" @act="actOnSatellite" />
      <section>
        <p class="label">Start a session</p>
        <ul>
          <li v-for="profile in profileList" :key="profile.id">
            <button class="profile" type="button" @click="start(profile)">
              <span class="name">{{ profile.name }}</span>
              <span class="summary">{{ profileSummary(profile) }}</span>
            </button>
          </li>
        </ul>
      </section>
      <SatelliteLaunch class="satellites" :session-running="false" :in-orbit="orbiting.length" :linked="!!linked" />
      <SatellitesView :orbiting="orbiting" :tasks="tasks" :done="done" @act="actOnSatellite" />
    </template>

    <SiteToggles
      v-if="siteRecipe && profileList && session !== undefined"
      :recipe="siteRecipe"
      :path="sitePath"
      :profiles="profileList"
      :session="session"
    />
  </main>
</template>

<style>
body {
  width: 300px;
}
</style>

<style scoped>
main {
  padding: 16px;
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.star {
  color: var(--glow);
}

.linked {
  margin-left: auto;
  color: var(--dim);
  font-size: 11px;
}

.linked + .settings {
  margin-left: 0;
}

.settings {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 6px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.settings:hover {
  background: var(--sky-raised);
  color: var(--starlight);
}

.label {
  margin: 0 0 8px;
  color: var(--dim);
  font-size: 12px;
}

ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: var(--sky-raised);
  transition:
    background 150ms,
    transform 150ms;
}

.profile:hover {
  background: var(--sky-hover);
}

.profile:active {
  transform: scale(0.98);
}

.name {
  font-weight: 600;
}

.summary {
  color: var(--dim);
  font-size: 12px;
}

.active {
  text-align: center;
}

.elapsed {
  margin: 4px 0 16px;
  font-size: 40px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

.elapsed.done {
  font-size: 28px;
}

.end {
  width: 100%;
  padding: 10px;
  background: var(--sky-raised);
}

.end:hover {
  background: var(--sky-hover);
}

.satellites {
  margin-top: 20px;
}

.offer {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--sky-raised);
}

.offer p {
  margin: 0;
  color: var(--dim);
  font-size: 12px;
}

.offer-buttons {
  display: flex;
  gap: 2px;
  margin: 6px 0 0 -8px;
}

.offer-buttons button {
  padding: 4px 8px;
  border-radius: 6px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.offer-buttons button:hover {
  background: var(--sky-hover);
  color: var(--starlight);
}

.offer-buttons .take {
  color: var(--glow);
}
</style>
