<script setup lang="ts">
import type {
  AppRule,
  Constellation,
  GateVisitRecord,
  SatelliteAction,
  SatelliteState,
  SessionRecord,
  Settings,
  SkyState,
  TimerSettings,
} from '@lock-in/core';
import {
  addWeeks,
  comets,
  constellationNames,
  constellations,
  formatDuration,
  milkyWay,
  planets,
  rareEvents,
  sessionSoFar,
  skyClarity,
  starColorFor,
  stardust,
  starMagnitude,
  stars,
  starSparkle,
  streaks,
  weekMonth,
  weekStart,
} from '@lock-in/core';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  actOnSatellite,
  addSampleData,
  constellationNames as savedNames,
  endSession,
  firstDayOfWeek,
  forgetBrowser,
  launchSatellite,
  nameConstellation,
  removeSampleData,
  sessionLog,
  setProfileApps,
  setProfileStarColor,
  setProfileTimer,
  setSettings,
  skySeen,
  skyState,
  spendEmergencyPass,
  startSession,
  turnedBack,
  useNow,
  useSnapshot,
} from './app';
import NightSky, {
  type SkyComet,
  type SkyConstellation,
  type SkyEvent,
  type SkyPlanet,
  type SkySatellite,
  type SkyStar,
} from './components/NightSky.vue';
import ProfileList from './components/ProfileList.vue';
import SettingsView from './components/SettingsView.vue';
import SkyPage from './components/SkyPage.vue';
import WeekReport from './components/WeekReport.vue';

const snapshot = useSnapshot();
const error = ref('');
// The Sky is home (PLAN §5). Profiles only edits them; sessions start from the Sky.
type View = 'sky' | 'profiles' | 'week' | 'settings';
const view = ref<View>('sky');
// Explore clears everything off the Sky page, so the sky is on its own.
const exploring = ref(false);
const nightSky = ref<InstanceType<typeof NightSky>>();
watch(view, (to) => to !== 'sky' && (exploring.value = false));
// The week the report is showing, so the sky can line its constellations up behind it.
const reportWeek = ref<number>();
watch(view, (to) => to !== 'week' && (reportWeek.value = undefined));
const tabs = computed(() => {
  const all: { view: View; label: string }[] = [
    { view: 'sky', label: 'Sky' },
    { view: 'profiles', label: 'Profiles' },
    { view: 'week', label: 'Your week' },
    { view: 'settings', label: 'Settings' },
  ];
  // The report waits between sessions.
  return all.filter((tab) => tab.view !== 'week' || !snapshot.value?.session);
});
// Pages slide in from the side their tab is on.
const order: View[] = ['sky', 'profiles', 'week', 'settings'];
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
// The report waits between sessions, so starting one goes back to the Sky.
watch(
  () => snapshot.value?.session?.id,
  (id) => {
    if (id && view.value === 'week') view.value = 'sky';
  },
);

// The night sky, worked out from the session log plus the running session, whose star forms
// as you focus.
const log = ref<SessionRecord[]>([]);
const now = useNow();
const minute = computed(() => Math.floor(now.value / 60_000));
const loadLog = async () => void (log.value = await sessionLog());
onMounted(() => run(loadLog));
// A session that just ended is in the log now, with any trips to sites during it.
watch(
  () => snapshot.value?.session?.id,
  (id, previous) => {
    if (previous && !id) void run(loadLog).then(() => run(loadSky));
  },
);
const sessions = computed(() => {
  const running = snapshot.value?.session;
  return running ? [...log.value, sessionSoFar(running, minute.value * 60_000)] : log.value;
});
// Weeks start on the computer's first day of the week, as in the weekly report. Nothing is shown
// until it's known, so constellations don't jump from one grouping to another.
const firstDay = ref<number>();
onMounted(
  () =>
    void firstDayOfWeek().then(
      (day) => (firstDay.value = day),
      () => (firstDay.value = 1),
    ),
);
const names = ref(new Map<string, string>());
const loadNames = async () => {
  names.value = new Map((await savedNames()).map((saved) => [saved.id, saved.name]));
};
onMounted(() => run(loadNames));
const skyStars = computed(() => stars(sessions.value));
// While a session goes on this is worked out again every minute, so weeks that haven't changed
// are handed back as they were, along with their stars as drawn (until a star color changes).
let lastWeeks: Constellation[] = [];
const weeks = computed(() =>
  firstDay.value === undefined ? [] : (lastWeeks = constellations(skyStars.value, firstDay.value, lastWeeks)),
);
let drawnStars = { colors: '', of: new WeakMap<Constellation, SkyStar[]>() };
const skyConstellations = computed<(SkyConstellation & { named: boolean })[]>(() => {
  const colors = new Map(snapshot.value?.profiles.map((p) => [p.id, p.starColor]));
  const colorsKey = JSON.stringify([...colors]);
  if (colorsKey !== drawnStars.colors) drawnStars = { colors: colorsKey, of: new WeakMap() };
  const named = constellationNames(weeks.value, names.value);
  return weeks.value.map((constellation, i) => {
    let drawn = drawnStars.of.get(constellation);
    if (!drawn) {
      drawn = constellation.stars.map((star, j) => ({
        id: star.id,
        ...constellation.points[j]!,
        color: starColorFor(star.profileId, colors.get(star.profileId)),
        magnitude: starMagnitude(star),
        sparkle: starSparkle(star),
      }));
      drawnStars.of.set(constellation, drawn);
    }
    return {
      id: constellation.id,
      name: named[i]!,
      named: names.value.has(constellation.id),
      weekStart: constellation.weekStart,
      month: weekMonth(constellation.weekStart),
      lines: constellation.lines,
      stars: drawn,
    };
  });
});
// Comets and rare events, worked out from the log, trips that went back to focus and this
// device's secret.
const sky = ref<SkyState>();
const resisted = ref<GateVisitRecord[]>([]);
const loadSky = async () => {
  // When the Sky last showed new things is kept here as it changes, so it's only read once.
  sky.value ??= await skyState();
  resisted.value = await turnedBack();
};
onMounted(() => run(loadSky));
const rare = computed(() => (sky.value ? rareEvents(log.value, sky.value.secret) : []));
const allComets = computed(() => (sky.value ? comets(resisted.value, sky.value.secret) : []));
// The Sky shows a month's weeks at a time: the latest, unless you step back to an earlier one.
// It's back on the latest whenever you leave the Sky or start a session.
const skyMonths = computed(() => [...new Set(skyConstellations.value.map((c) => c.month))]);
const steppedMonth = ref<number>();
const skyMonth = computed(() => (skyMonths.value.includes(steppedMonth.value!) ? steppedMonth.value : undefined));
watch(view, (to) => to !== 'sky' && (steppedMonth.value = undefined));
watch(
  () => snapshot.value?.session?.id,
  (id) => id && (steppedMonth.value = undefined),
);
const constellationOfWeek = computed(() => new Map(skyConstellations.value.map((c) => [c.weekStart, c.id])));
const weekConstellation = (at: number) =>
  firstDay.value === undefined ? undefined : constellationOfWeek.value.get(weekStart(at, firstDay.value));
// By when its session started, like its star, though it's dated by when the session ended.
const skyEvents = computed<SkyEvent[]>(() => {
  const started = new Map(log.value.map((session) => [session.id, session.startedAt]));
  return rare.value.map((event) => ({
    ...event,
    constellationId: weekConstellation(started.get(event.id) ?? event.at),
  }));
});
/** The most comets a constellation shows, the latest. */
const cometsPerWeek = 3;
const thisWeek = computed(() => (firstDay.value === undefined ? 0 : weekStart(minute.value * 60_000, firstDay.value)));
// The Sky shows this week's comets (or a month's, stepped back to one); exploring and the
// weekly report show each week's.
const skyComets = computed<SkyComet[]>(() => {
  const byWeek = new Map<string, SkyComet[]>();
  for (const comet of allComets.value) {
    const constellationId = weekConstellation(comet.at);
    if (!constellationId) continue;
    byWeek.set(constellationId, [...(byWeek.get(constellationId) ?? []), { ...comet, constellationId }]);
  }
  const all = [...byWeek.values()].flatMap((list) => list.slice(-cometsPerWeek));
  if (exploring.value || reportWeek.value !== undefined) return all;
  const month = skyMonth.value;
  if (month === undefined) return all.filter((comet) => comet.at >= thisWeek.value);
  const months = new Map(skyConstellations.value.map((c) => [c.id, c.month]));
  return all.filter((comet) => months.get(comet.constellationId) === month);
});
// Satellites circle the sky: in orbit, back and waiting to be sorted, or on the task list, the
// latest launched. One ticked off stays until it has drifted away, the next time the Sky shows.
const mostSatellites = 20;
const playNow = ref<string[]>([]);
const skySatellites = computed<SkySatellite[]>(() => {
  const seenAt = sky.value?.seenAt;
  const leaving = (id: string, stateAt: number) =>
    seenAt !== undefined && (stateAt > seenAt || playNow.value.includes(`satellite:${id}`));
  return (snapshot.value?.satellites ?? [])
    .filter((s) => ['orbiting', 'back', 'task'].includes(s.state) || (s.state === 'done' && leaving(s.id, s.stateAt)))
    .sort((a, b) => a.launchedAt - b.launchedAt)
    .slice(-mostSatellites)
    .map((s) => ({ id: s.id, text: s.text, done: s.state === 'done' }));
});
// Each plays once, the next time the Sky is shown between sessions, then counts as seen.
const visible = ref(document.visibilityState === 'visible');
const onVisibility = () => (visible.value = document.visibilityState === 'visible');
onMounted(() => document.addEventListener('visibilitychange', onVisibility));
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibility));
const unseen = computed(() => {
  const seenAt = sky.value?.seenAt;
  if (seenAt === undefined || view.value !== 'sky' || !visible.value || snapshot.value?.session) return [];
  return [
    ...skyEvents.value.map((event) => ({ key: `event:${event.id}`, at: event.at })),
    ...skyComets.value.map((comet) => ({ key: `comet:${comet.id}`, at: comet.at })),
    ...(snapshot.value?.satellites ?? [])
      .filter((s) => s.state === 'done' && skySatellites.value.some((shown) => shown.id === s.id))
      .map((s) => ({ key: `satellite:${s.id}`, at: s.stateAt })),
  ]
    .filter((item) => item.at > seenAt)
    .sort((a, b) => a.at - b.at);
});
watch(unseen, (items) => {
  const latest = items[items.length - 1]?.at;
  if (latest === undefined || !sky.value) return;
  // A few at most, the latest. What played before stays, so a satellite drifting away isn't cut short.
  playNow.value = [...playNow.value, ...items.slice(-4).map((item) => item.key)];
  sky.value = { ...sky.value, seenAt: latest };
  void run(() => skySeen(latest));
});

const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const skyPlanets = computed<SkyPlanet[]>(() => {
  const colors = new Map(snapshot.value?.profiles.map((p) => [p.id, p.starColor]));
  return planets(skyStars.value, rare.value).map((planet) => ({
    ...planet,
    label: `${monthName.format(planet.monthStart)} · ${formatDuration(planet.focusMs)}`,
    tint: starColorFor(planet.topProfileId, colors.get(planet.topProfileId)),
  }));
});
const starCount = computed(() => skyConstellations.value.reduce((count, c) => count + c.stars.length, 0));
const reportConstellation = computed(() => skyConstellations.value.find((c) => c.weekStart === reportWeek.value));
// Streaks by the end of the week the report shows. Only this week's has one running.
const reportStreaks = computed(() => {
  if (reportWeek.value === undefined) return { current: 0, longest: 0 };
  const end = addWeeks(reportWeek.value, 1);
  const at = Math.min(minute.value * 60_000, end - 1);
  const counted = streaks(skyStars.value, at);
  return at < end - 1 ? counted : { ...counted, current: 0 };
});
const rename = (id: string, name: string) =>
  run(async () => {
    await nameConstellation(id, name);
    await loadNames();
  });
const totalStardust = computed(() => stardust(sessions.value));
const milkyWayFill = computed(() => milkyWay(sessions.value));
// Exploring shows it clear; otherwise it's hazy between sessions.
const clarity = computed(() =>
  exploring.value ? 1 : skyClarity(now.value, !!snapshot.value?.session, log.value[log.value.length - 1]),
);

const stopExploring = (event: KeyboardEvent) => {
  if (event.key === 'Escape') exploring.value = false;
};
onMounted(() => window.addEventListener('keydown', stopExploring));
onUnmounted(() => window.removeEventListener('keydown', stopExploring));

const sampleData = (action: 'add' | 'remove') =>
  run(async () => {
    await (action === 'add' ? addSampleData() : removeSampleData());
    await loadLog();
    await loadNames();
    await loadSky();
  });

const inState = (state: SatelliteState) => snapshot.value?.satellites.filter((s) => s.state === state) ?? [];
const satellites = computed(() => ({
  back: inState('back'),
  orbiting: inState('orbiting'),
  tasks: inState('task'),
  // The latest first. The core only sends tasks ticked off in the last day.
  done: inState('done').sort((a, b) => b.stateAt - a.stateAt),
}));
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
  <NightSky
    ref="nightSky"
    :constellations="skyConstellations"
    :month="skyMonth"
    :planets="skyPlanets"
    :milky-way="milkyWayFill"
    :clarity="clarity"
    :drift="exploring"
    :names="view === 'sky' && exploring"
    :week="reportWeek"
    :comets="skyComets"
    :events="skyEvents"
    :satellites="skySatellites"
    :satellite-text="view === 'sky' && exploring && !snapshot?.session"
    :play="playNow"
  />
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

    <Transition :name="slide" mode="out-in">
      <div v-if="snapshot && firstDay !== undefined" :key="view">
        <SkyPage
          v-if="view === 'sky'"
          v-model:exploring="exploring"
          :profiles="snapshot.profiles"
          :session="snapshot.session"
          :passes-left="snapshot.passesLeft"
          :satellites="satellites"
          :star-count="starCount"
          :stardust="totalStardust"
          :months="skyMonths"
          :month="skyMonth"
          @month="(month: number | undefined) => (steppedMonth = month)"
          @start="(id: string) => run(() => startSession(id))"
          @end="run(endSession)"
          @pass="run(spendEmergencyPass)"
          @launch="launch"
          @act="act"
          @zoom="(factor: number) => nightSky?.zoom(factor)"
        />
        <ProfileList
          v-else-if="view === 'profiles'"
          :profiles="snapshot.profiles"
          :can-hide-apps="snapshot.canHideApps"
          @set-timer="(id: string, timer: TimerSettings) => run(() => setProfileTimer(id, timer))"
          @set-apps="(id: string, apps: AppRule[]) => run(() => setProfileApps(id, apps))"
          @set-star-color="(id: string, color: string) => run(() => setProfileStarColor(id, color))"
        />
        <WeekReport
          v-else-if="view === 'week'"
          :first-day="firstDay"
          :constellation="reportConstellation"
          :events="rare"
          :comets="allComets"
          :streaks="reportStreaks"
          @week="(week: number) => (reportWeek = week)"
          @rename="rename"
        />
        <SettingsView
          v-else
          :settings="snapshot.settings"
          :passes-left="snapshot.passesLeft"
          :browsers="snapshot.browsers"
          :session-running="!!snapshot.session"
          @update:settings="(settings: Settings) => run(() => setSettings(settings))"
          @forget-browser="(path: string) => run(() => forgetBrowser(path))"
          @sample-data="sampleData"
          @close="view = 'sky'"
        />
      </div>
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

@media (prefers-reduced-motion: reduce) {
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

.error {
  color: #f0a3a3;
  font-size: 12px;
}
</style>
