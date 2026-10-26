<script lang="ts" setup>
import { findRecipe, type Profile, type SiteRecipe } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, onUnmounted, ref } from 'vue';
import SiteToggles from '@/components/SiteToggles.vue';

const session = useStorageItem(activeSession);
const profileList = useStorageItem(profiles);

const activeProfile = computed(() => profileList.value?.find((p) => p.id === session.value?.profileId));

// activeTab lets the popup read the current tab's URL when the user opens it.
const siteRecipe = ref<SiteRecipe>();
void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.url) siteRecipe.value = findRecipe(recipes, tab.url);
});

// Ticks once a second, only while the popup is open.
const now = ref(Date.now());
const tick = setInterval(() => (now.value = Date.now()), 1000);
onUnmounted(() => clearInterval(tick));

const elapsed = computed(() => {
  if (!session.value) return '';
  const totalSeconds = Math.max(0, Math.floor((now.value - session.value.startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
});

function describe(profile: Profile): string {
  return profile.sites
    .map((site) => {
      const recipe = recipes.find((r) => r.id === site.recipeId);
      const name = recipe?.name ?? site.recipeId;
      return site.toggles?.grayscale ? `${name} ${site.level} · grayscale` : `${name} ${site.level}`;
    })
    .join(', ');
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
    </header>

    <section v-if="session" class="active">
      <p class="label">Locked in · {{ activeProfile?.name ?? 'Unknown profile' }}</p>
      <p class="elapsed">{{ elapsed }}</p>
      <button class="end" type="button" @click="endSession()">End session</button>
    </section>

    <section v-else-if="profileList">
      <p class="label">Start a session</p>
      <ul>
        <li v-for="profile in profileList" :key="profile.id">
          <button class="profile" type="button" @click="start(profile)">
            <span class="name">{{ profile.name }}</span>
            <span class="summary">{{ describe(profile) }}</span>
          </button>
        </li>
      </ul>
    </section>

    <SiteToggles
      v-if="siteRecipe && profileList && session !== undefined"
      :recipe="siteRecipe"
      :profiles="profileList"
      :session="session"
    />
  </main>
</template>

<style>
:root {
  --sky: #0b1020;
  --sky-raised: #151b31;
  --sky-hover: #1e2643;
  --starlight: #f3f0e6;
  --dim: #9aa3bf;
  --glow: #f5c86b;
  /* A quick, slightly bouncy spring for UI motion. */
  --spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001);
  color-scheme: dark;
}

body {
  margin: 0;
  width: 300px;
  background: var(--sky);
  color: var(--starlight);
  font: 14px/1.4 system-ui, -apple-system, sans-serif;
}

button {
  font: inherit;
  color: inherit;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
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
  transition: background 150ms, transform 150ms;
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

.end {
  width: 100%;
  padding: 10px;
  background: var(--sky-raised);
}

.end:hover {
  background: var(--sky-hover);
}
</style>
