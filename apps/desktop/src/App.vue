<script setup lang="ts">
import type { AppRule, SatelliteAction, SatelliteState, SessionRecord, Settings, TimerSettings } from '@lock-in/core';
import { sessionSoFar, skyClarity, starColorFor, stardust, starMagnitude, stars, starSparkle } from '@lock-in/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  actOnSatellite,
  endSession,
  forgetBrowser,
  launchSatellite,
  sessionLog,
  setProfileApps,
  setProfileStarColor,
  setProfileTimer,
  setSettings,
  spendEmergencyPass,
  startSession,
  useNow,
  useSnapshot,
} from './app';
import NightSky, { type SkyStar } from './components/NightSky.vue';
import ProfileList from './components/ProfileList.vue';
import SatelliteLaunch from './components/SatelliteLaunch.vue';
import SatellitesBack from './components/SatellitesBack.vue';
import SatellitesView from './components/SatellitesView.vue';
import SessionView from './components/SessionView.vue';
import SettingsView from './components/SettingsView.vue';
import WeekReport from './components/WeekReport.vue';

const snapshot = useSnapshot();
const error = ref('');
// The dashboard, or Settings or the weekly report in its place, or just the sky.
type View = 'dashboard' | 'settings' | 'week' | 'sky';
const view = ref<View>('dashboard');
const toggle = (to: Exclude<View, 'dashboard'>) => (view.value = view.value === to ? 'dashboard' : to);
// The report waits between sessions, so starting one goes back to the dashboard.
watch(
  () => snapshot.value?.session?.id,
  (id) => {
    if (id && view.value === 'week') view.value = 'dashboard';
  },
);

// The night sky, worked out from the session log plus the running session, whose star forms
// as you focus.
const log = ref<SessionRecord[]>([]);
const now = useNow();
const minute = computed(() => Math.floor(now.value / 60_000));
const loadLog = () => run(async () => void (log.value = await sessionLog()));
onMounted(loadLog);
// A session that just ended is in the log now.
watch(
  () => snapshot.value?.session?.id,
  (id, previous) => {
    if (previous && !id) void loadLog();
  },
);
const sessions = computed(() => {
  const running = snapshot.value?.session;
  return running ? [...log.value, sessionSoFar(running, minute.value * 60_000)] : log.value;
});
const skyStars = computed<SkyStar[]>(() => {
  const colors = new Map(snapshot.value?.profiles.map((p) => [p.id, p.starColor]));
  return stars(sessions.value).map((star) => ({
    id: star.id,
    x: star.x,
    y: star.y,
    color: starColorFor(star.profileId, colors.get(star.profileId)),
    magnitude: starMagnitude(star),
    sparkle: starSparkle(star),
  }));
});
const totalStardust = computed(() => stardust(sessions.value));
// The Sky view shows it clear; otherwise it's hazy between sessions.
const clarity = computed(() =>
  view.value === 'sky' ? 1 : skyClarity(now.value, !!snapshot.value?.session, log.value[log.value.length - 1]),
);

const closeSky = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && view.value === 'sky') view.value = 'dashboard';
};
onMounted(() => window.addEventListener('keydown', closeSky));
onUnmounted(() => window.removeEventListener('keydown', closeSky));

const satellites = (state: SatelliteState) => snapshot.value?.satellites.filter((s) => s.state === state) ?? [];
const back = computed(() => satellites('back'));
const orbiting = computed(() => satellites('orbiting'));
const tasks = computed(() => satellites('task'));
// The latest first. The core only sends tasks ticked off in the last day.
const done = computed(() => satellites('done').sort((a, b) => b.stateAt - a.stateAt));
const launch = (text: string) => run(async () => void (await launchSatellite(text)));
const act = (id: string, action: SatelliteAction) => run(() => actOnSatellite(id, action));

async function run(action: () => Promise<void>) {
  error.value = '';
  try {
    await action();
  } catch (reason) {
    error.value = `Something went wrong: ${String(reason)}`;
  }
}
</script>

<template>
  <NightSky :stars="skyStars" :clarity="clarity" />
  <main>
    <header>
      <span class="star" aria-hidden="true">✦</span>
      <h1>Lock In</h1>
      <button class="view" type="button" :aria-pressed="view === 'sky'" @click="toggle('sky')">Sky</button>
      <button
        v-if="snapshot && !snapshot.session"
        class="view"
        type="button"
        :aria-pressed="view === 'week'"
        @click="toggle('week')"
      >
        Your week
      </button>
      <button class="view" type="button" :aria-pressed="view === 'settings'" @click="toggle('settings')">
        Settings
      </button>
    </header>

    <!-- The cards drift toward you as they fade, leaving just the sky, and come back the same way. -->
    <Transition name="puff">
      <div v-show="view !== 'sky'" class="deck">
        <SettingsView
          v-if="snapshot && view === 'settings'"
          :settings="snapshot.settings"
          :passes-left="snapshot.passesLeft"
          :browsers="snapshot.browsers"
          :session-running="!!snapshot.session"
          @update:settings="(settings: Settings) => run(() => setSettings(settings))"
          @forget-browser="(path: string) => run(() => forgetBrowser(path))"
          @close="view = 'dashboard'"
        />
        <template v-else-if="snapshot?.session">
          <SessionView
            :session="snapshot.session"
            :passes-left="snapshot.passesLeft"
            @end="run(endSession)"
            @pass="run(spendEmergencyPass)"
          />
          <!-- Only how many are in orbit, not what they say, so they don't pull you back in. -->
          <SatelliteLaunch class="satellites" session-running :in-orbit="orbiting.length" @launch="launch" />
        </template>
        <WeekReport v-else-if="snapshot && view === 'week'" />
        <template v-else-if="snapshot">
          <!-- Satellites wait here after a session, with nothing popping up to break the flow. -->
          <SatellitesBack v-if="back.length" :satellites="back" @act="act" />
          <ProfileList
            :profiles="snapshot.profiles"
            :can-hide-apps="snapshot.canHideApps"
            @start="(id: string) => run(() => startSession(id))"
            @set-timer="(id: string, timer: TimerSettings) => run(() => setProfileTimer(id, timer))"
            @set-apps="(id: string, apps: AppRule[]) => run(() => setProfileApps(id, apps))"
            @set-star-color="(id: string, color: string) => run(() => setProfileStarColor(id, color))"
          />
          <SatelliteLaunch class="satellites" :session-running="false" :in-orbit="0" @launch="launch" />
          <SatellitesView :orbiting="orbiting" :tasks="tasks" :done="done" @act="act" />
        </template>
      </div>
    </Transition>

    <Transition name="fade">
      <p v-if="view === 'sky'" class="sky-stats">
        <template v-if="skyStars.length">
          {{ skyStars.length }} {{ skyStars.length === 1 ? 'star' : 'stars' }} ·
          {{ totalStardust.toLocaleString() }} stardust
        </template>
        <template v-else>Your first star forms after five minutes of focus.</template>
      </p>
    </Transition>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
main {
  /* See-through, so the sky shows through the cards. */
  --sky-raised: rgb(21 27 49 / 0.72);
  --sky-hover: rgb(30 38 67 / 0.82);
  position: relative;
  z-index: 1;
  max-width: 480px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
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

.view {
  padding: 2px 8px;
  border-radius: 6px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.view:first-of-type {
  margin-left: auto;
}

.deck {
  transform-origin: 50% 30%;
}

.puff-enter-active,
.puff-leave-active {
  transition:
    opacity 700ms ease,
    transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1),
    filter 700ms ease;
}

.puff-enter-from,
.puff-leave-to {
  opacity: 0;
  transform: scale(1.12);
  filter: blur(6px);
}

.sky-stats {
  position: fixed;
  right: 0;
  bottom: 24px;
  left: 0;
  margin: 0;
  color: var(--dim);
  font-size: 12px;
  text-align: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 700ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .puff-enter-from,
  .puff-leave-to {
    transform: none;
    filter: none;
  }
}

.view:hover,
.view[aria-pressed='true'] {
  background: var(--sky-raised);
  color: var(--starlight);
}

.satellites {
  margin-top: 32px;
}

.error {
  color: #f0a3a3;
  font-size: 12px;
}
</style>
