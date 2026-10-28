<script setup lang="ts">
import type { AppRule, ProfileSummary, Strictness, TimerSettings } from '@lock-in/core';
import { starColorFor } from '@lock-in/core';
import { ref } from 'vue';
import AppRulesEditor from './AppRulesEditor.vue';
import StarColorPicker from './StarColorPicker.vue';
import TimerEditor from './TimerEditor.vue';
import Unfold from './Unfold.vue';

// Only for setting profiles up, as the Observatory HUD's channels (PLAN Phase 5): each profile is a
// frame with a port in its star color, opening in place onto its Timer, Apps, Sites and Star
// panels. Sessions start from the Sky (SkyPage.vue), which keeps this page's purpose clear.
defineProps<{
  profiles: ProfileSummary[];
  canHideApps: boolean;
  /** How many stars each profile has in the sky, by its id. */
  starCounts: Record<string, number>;
}>();
const emit = defineEmits<{
  'set-timer': [profileId: string, timer: TimerSettings];
  'set-apps': [profileId: string, apps: AppRule[]];
  'set-star-color': [profileId: string, color: string];
}>();

// Which profile is open, one at a time, and on which panel.
type Panel = 'timer' | 'apps' | 'sites' | 'star';
const panels: { id: Panel; label: string }[] = [
  { id: 'timer', label: 'Timer' },
  { id: 'apps', label: 'Apps' },
  { id: 'sites', label: 'Sites' },
  { id: 'star', label: 'Star' },
];
const open = ref<{ profileId: string; panel: Panel }>();
const toggle = (profileId: string) =>
  (open.value = open.value?.profileId === profileId ? undefined : { profileId, panel: 'timer' });

const strictness: Record<Strictness, string> = { gentle: 'Gentle', medium: 'Medium', hard: 'Hard' };

function summary(profile: ProfileSummary): string {
  const { minutes } = profile.timer;
  const apps = profile.apps.length;
  return [
    minutes > 0 ? `${minutes} min · ${strictness[profile.timer.strictness]}` : 'No timer',
    apps > 0 && `${apps} ${apps === 1 ? 'app' : 'apps'}`,
  ]
    .filter((part) => typeof part === 'string')
    .join(' · ');
}
</script>

<template>
  <section class="profiles" aria-labelledby="profiles-intro">
    <p id="profiles-intro" class="intro mono">How each session works · Sessions start from the Sky</p>
    <div class="channels">
      <div
        v-for="profile in profiles"
        :key="profile.id"
        class="card channel"
        :style="{ '--c': starColorFor(profile.id, profile.starColor) }"
      >
        <span class="port" aria-hidden="true" />
        <button
          class="head"
          type="button"
          :aria-expanded="open?.profileId === profile.id"
          :aria-controls="`profile-${profile.id}`"
          @click="toggle(profile.id)"
        >
          <b>{{ profile.name }}</b>
          <span class="stars mono">
            <b>{{ String(starCounts[profile.id] ?? 0).padStart(2, '0') }}</b>
            {{ starCounts[profile.id] === 1 ? 'star' : 'stars' }}
          </span>
          <span class="mono">{{ summary(profile) }}</span>
        </button>
        <Unfold>
          <div v-if="open?.profileId === profile.id" :id="`profile-${profile.id}`">
            <nav class="panels" :aria-label="`Settings for ${profile.name}`">
              <button
                v-for="panel in panels"
                :key="panel.id"
                class="tab mono"
                type="button"
                :aria-current="open.panel === panel.id ? 'page' : undefined"
                @click="open.panel = panel.id"
              >
                {{ panel.label }}
              </button>
            </nav>
            <div :key="open.panel" class="panel">
              <TimerEditor
                v-if="open.panel === 'timer'"
                :timer="profile.timer"
                @update:timer="emit('set-timer', profile.id, $event)"
              />
              <AppRulesEditor
                v-else-if="open.panel === 'apps'"
                :apps="profile.apps"
                :can-hide="canHideApps"
                @update:apps="emit('set-apps', profile.id, $event)"
              />
              <p v-else-if="open.panel === 'sites'" class="help">
                Which sites this profile tames or redirects, and how, is set in the Lock In browser extension's
                settings.
              </p>
              <div v-else class="star">
                <StarColorPicker
                  :color="starColorFor(profile.id, profile.starColor)"
                  :profile-name="profile.name"
                  @update:color="emit('set-star-color', profile.id, $event)"
                />
                <p class="help">The color of this profile's stars in your sky.</p>
              </div>
            </div>
          </div>
        </Unfold>
      </div>
    </div>
    <p class="help foot">Sites for each profile are set in the browser extension's settings, and apps here.</p>
  </section>
</template>

<style scoped>
.intro {
  margin: 4px 0 14px;
}

.channels {
  display: grid;
  gap: 12px;
}

/* The profile's port: a glowing dot in its star color on the frame's top edge. */
.port {
  position: absolute;
  top: -3px;
  left: 16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 8px var(--c);
}

.head {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px 10px;
  width: 100%;
  padding: 12px 12px 10px;
  border-radius: 0;
  background: none;
  text-align: left;
}

.head > b {
  font-size: 13.5px;
  font-weight: 600;
}

.stars {
  grid-row: span 2;
  text-align: right;
}

.stars b {
  display: block;
  color: var(--c);
  font:
    200 22px/1 system-ui,
    sans-serif;
  letter-spacing: -0.02em;
  text-shadow: 0 0 12px color-mix(in srgb, var(--c) 50%, transparent);
}

.panels {
  display: flex;
  gap: 14px;
  margin: 0 12px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

/* Mono tabs with a glowing dot for the open panel, like the pages' tabs. */
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border-radius: 0;
  background: none;
  transition: color 400ms;
}

.tab::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 400ms;
}

.tab:hover,
.tab[aria-current='page'] {
  color: var(--starlight);
}

.tab[aria-current='page']::before {
  opacity: 1;
  box-shadow: 0 0 6px currentColor;
}

.panel {
  padding: 4px 12px 10px;
  animation: rise 500ms var(--ease);
}

@keyframes rise {
  from {
    opacity: 0;
    translate: 0 6px;
  }
}

.help {
  margin: 10px 0 4px;
  color: var(--faint);
  font-size: 11.5px;
}

.star {
  padding-top: 10px;
}

.foot {
  margin-top: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    animation: none;
  }

  .tab,
  .tab::before {
    transition: none;
  }
}
</style>
