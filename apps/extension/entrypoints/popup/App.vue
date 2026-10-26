<script lang="ts" setup>
import { findRecipe, formatClock, timerStatus, type Profile, type SiteRecipe } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, onUnmounted, ref } from 'vue';
import SiteToggles from '@/components/SiteToggles.vue';

const session = useStorageItem(activeSession);
const profileList = useStorageItem(profiles);
const linked = useStorageItem(desktopLinked);

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

function openSettings() {
  void browser.runtime.openOptionsPage();
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
      <button class="end" type="button" @click="endSession()">End session</button>
    </section>

    <section v-else-if="profileList">
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
</style>
