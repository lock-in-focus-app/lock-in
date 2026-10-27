<script setup lang="ts">
import type { AppRule, SatelliteAction, SatelliteState, SessionRecord, Settings, TimerSettings } from '@lock-in/core';
import { sessionSoFar, skyClarity, starColorFor, stardust, starMagnitude, stars, starSparkle } from '@lock-in/core';
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';
import {
  actOnSatellite,
  addSampleData,
  endSession,
  forgetBrowser,
  launchSatellite,
  removeSampleData,
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
const tabs = computed(() => {
  const all: { view: View; label: string }[] = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'sky', label: 'Sky' },
    { view: 'week', label: 'Your week' },
    { view: 'settings', label: 'Settings' },
  ];
  // The report waits between sessions.
  return all.filter((tab) => tab.view !== 'week' || !snapshot.value?.session);
});
// The page under the tabs. A running session takes the dashboard's place, and the Sky keeps
// whatever page was there, to come back to.
const pane = ref<'home' | 'session' | 'week' | 'settings'>('home');
watchEffect(() => {
  if (view.value === 'sky') return;
  pane.value = view.value === 'dashboard' ? (snapshot.value?.session ? 'session' : 'home') : view.value;
});
// Pages slide in from the side their tab is on.
const order: View[] = ['dashboard', 'sky', 'week', 'settings'];
const slide = ref<'slide-forward' | 'slide-back'>('slide-forward');
watch(view, (to, from) => (slide.value = order.indexOf(to) >= order.indexOf(from) ? 'slide-forward' : 'slide-back'));

// A glowing pill that glides to the selected tab.
const tabBar = ref<HTMLElement>();
const pill = ref({ left: 0, width: 0 });
function placePill() {
  const selected = tabBar.value?.querySelector<HTMLElement>('[aria-current="page"]');
  if (selected) pill.value = { left: selected.offsetLeft, width: selected.offsetWidth };
}
watch([view, tabs], () => void nextTick(placePill));
const tabBarResized = new ResizeObserver(placePill);
onMounted(() => tabBar.value && tabBarResized.observe(tabBar.value));
onUnmounted(() => tabBarResized.disconnect());
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

const sampleData = (action: 'add' | 'remove') =>
  run(async () => {
    await (action === 'add' ? addSampleData() : removeSampleData());
    await loadLog();
  });

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
      <nav ref="tabBar" class="tabs" aria-label="Pages">
        <span class="pill" :style="{ translate: `${pill.left}px 0`, width: `${pill.width}px` }" aria-hidden="true" />
        <button
          v-for="tab in tabs"
          :key="tab.view"
          class="tab"
          type="button"
          :aria-current="view === tab.view ? 'page' : undefined"
          @click="view = tab.view"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <!-- The cards drift toward you as they fade, leaving just the sky, and come back the same way. -->
    <Transition name="puff">
      <div v-show="view !== 'sky'" class="deck">
        <Transition :name="slide" mode="out-in">
          <div v-if="snapshot" :key="pane" class="pane">
            <SettingsView
              v-if="pane === 'settings'"
              :settings="snapshot.settings"
              :passes-left="snapshot.passesLeft"
              :browsers="snapshot.browsers"
              :session-running="!!snapshot.session"
              @update:settings="(settings: Settings) => run(() => setSettings(settings))"
              @forget-browser="(path: string) => run(() => forgetBrowser(path))"
              @sample-data="sampleData"
              @close="view = 'dashboard'"
            />
            <WeekReport v-else-if="pane === 'week'" />
            <template v-else-if="pane === 'session' && snapshot.session">
              <SessionView
                :session="snapshot.session"
                :passes-left="snapshot.passesLeft"
                @end="run(endSession)"
                @pass="run(spendEmergencyPass)"
              />
              <!-- Only how many are in orbit, not what they say, so they don't pull you back in. -->
              <SatelliteLaunch class="satellites" session-running :in-orbit="orbiting.length" @launch="launch" />
            </template>
            <template v-else>
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

.tabs {
  position: relative;
  display: flex;
  margin-left: auto;
}

.pill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border: 1px solid rgb(205 215 255 / 0.12);
  border-radius: 8px;
  background: rgb(40 50 88 / 0.6);
  box-shadow: 0 0 14px -4px rgb(160 180 255 / 0.25);
  transition:
    translate 500ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.tab {
  position: relative;
  padding: 4px 10px;
  border-radius: 8px;
  background: none;
  color: var(--dim);
  font-size: 12px;
  transition: color 300ms;
}

.tab:hover,
.tab[aria-current='page'] {
  color: var(--starlight);
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

.slide-forward-enter-active,
.slide-back-enter-active {
  transition:
    opacity 380ms ease,
    transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 380ms ease;
}

.slide-forward-leave-active,
.slide-back-leave-active {
  transition:
    opacity 200ms ease,
    transform 220ms ease-in,
    filter 200ms ease;
}

.slide-forward-enter-from,
.slide-back-leave-to {
  opacity: 0;
  transform: translateX(28px);
  filter: blur(3px);
}

.slide-forward-leave-to,
.slide-back-enter-from {
  opacity: 0;
  transform: translateX(-28px);
  filter: blur(3px);
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
  .puff-leave-to,
  .slide-forward-enter-from,
  .slide-forward-leave-to,
  .slide-back-enter-from,
  .slide-back-leave-to {
    transform: none;
    filter: none;
  }

  .pill {
    transition: none;
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
