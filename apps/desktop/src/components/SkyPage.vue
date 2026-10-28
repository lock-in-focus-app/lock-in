<script setup lang="ts">
import type { ActiveSession, ProfileSummary, Satellite, SatelliteAction } from '@lock-in/core';
import { formatDuration, starColorFor } from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import ExploreView from './ExploreView.vue';
import LaunchDock from './LaunchDock.vue';
import SatelliteLaunch from './SatelliteLaunch.vue';
import SatellitesBack from './SatellitesBack.vue';
import SatellitesView from './SatellitesView.vue';
import SessionView from './SessionView.vue';
import Unfold from './Unfold.vue';

// The home page (PLAN §5): the sky, with the profiles along the bottom to lock in with, the
// running session floating over it, and satellites, in the Observatory HUD's hairline frames and
// small readouts (PLAN Phase 5). Explore clears everything away so the sky
// is on its own; it all drifts toward you as it fades, and comes back the same way.
const props = defineProps<{
  profiles: ProfileSummary[];
  session: ActiveSession | null;
  passesLeft: number;
  satellites: { back: Satellite[]; orbiting: Satellite[]; tasks: Satellite[]; done: Satellite[] };
  starCount: number;
  /** What the readout at the top shows: the date, time locked in today, and the streak running now. */
  glance: { date: string; lockedInMs: number; streak: number };
  stardust: number;
  /** For Explore's readouts: how many weeks and planets there are, how far in it's zoomed, and the
   * constellation in the crosshair. */
  weekCount: number;
  planetCount: number;
  zoom: number;
  aimed?: { id: string; name: string; named: boolean; weekStart: number };
  thisWeek: number;
  /** The months with constellations, oldest first, and the one the Sky shows if stepped back (else the latest). */
  months: number[];
  month?: number;
}>();
const exploring = defineModel<boolean>('exploring', { required: true });
const emit = defineEmits<{
  start: [profileId: string];
  end: [];
  pass: [];
  launch: [text: string];
  act: [id: string, action: SatelliteAction];
  /** Zoom the sky in (above 1) or out, while exploring. */
  zoom: [factor: number];
  /** Glide back to where exploring starts, around the latest weeks. */
  recenter: [];
  rename: [id: string, name: string];
  /** Show an earlier month's constellations on the Sky, or the latest (undefined). */
  month: [month: number | undefined];
}>();

// Stepping through the months, a month's constellations at a time.
const shownIndex = computed(() =>
  props.month === undefined ? props.months.length - 1 : props.months.indexOf(props.month),
);
const monthName = new Intl.DateTimeFormat(undefined, { month: 'short' });
const monthAndYear = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const monthLabel = computed(() => {
  const month = props.months[shownIndex.value];
  if (month === undefined) return '';
  return new Date(month).getFullYear() === new Date().getFullYear()
    ? monthName.format(month)
    : monthAndYear.format(month);
});
function step(by: number) {
  const index = shownIndex.value + by;
  if (index < 0 || index >= props.months.length) return;
  emit('month', index === props.months.length - 1 ? undefined : props.months[index]);
}

/** A count as a readout shows it, e.g. 03. */
const counted = (count: number) => String(count).padStart(2, '0');

// The running session glows in its profile's star color.
const sessionColor = computed(() => {
  const id = props.session?.profileId ?? '';
  return starColorFor(id, props.profiles.find((profile) => profile.id === id)?.starColor);
});

const showingTasks = ref(false);
const taskCount = computed(() => props.satellites.orbiting.length + props.satellites.tasks.length);
const hasTasks = computed(() => taskCount.value > 0 || props.satellites.done.length > 0);
// Tasks wait while you focus, so they don't pull you back in.
watch(
  () => props.session,
  (session) => session && (showingTasks.value = false),
);
</script>

<template>
  <div class="sky-page">
    <Transition name="puff">
      <div v-show="!exploring" class="layer">
        <p class="glance mono">
          <span>{{ glance.date }}</span>
          <span>
            <span title="Time locked in today, including any past the timer"
              >Today <b>{{ formatDuration(glance.lockedInMs) }}</b></span
            >
            <span v-if="glance.streak >= 2" title="Days in a row with a star">
              · Streak <b>{{ glance.streak }} days</b></span
            >
          </span>
        </p>
        <SatellitesBack
          v-if="!session && satellites.back.length"
          :satellites="satellites.back"
          @act="(id, action) => emit('act', id, action)"
        />

        <div class="middle">
          <SessionView
            v-if="session"
            :session="session"
            :passes-left="passesLeft"
            :color="sessionColor"
            @end="emit('end')"
            @pass="emit('pass')"
          />
        </div>

        <!-- The task list opens above the profiles, from the Tasks button below. -->
        <Unfold>
          <div v-if="showingTasks" id="tasks" class="tasks">
            <SatellitesView
              :orbiting="satellites.orbiting"
              :tasks="satellites.tasks"
              :done="satellites.done"
              @act="(id, action) => emit('act', id, action)"
            />
          </div>
        </Unfold>
        <!-- Sessions come first, so the profiles sit above the satellites. -->
        <LaunchDock v-if="!session" :profiles="profiles" :first-star="starCount === 0" @start="emit('start', $event)" />
        <SatelliteLaunch :session-running="!!session" @launch="emit('launch', $event)" />

        <div class="foot">
          <button class="mono" type="button" title="Clear the screen and look around the sky" @click="exploring = true">
            ⌖ Explore the sky
          </button>
          <span v-if="!session && months.length > 1" class="months mono">
            <button type="button" aria-label="Earlier month" :disabled="shownIndex <= 0" @click="step(-1)">‹</button>
            <b aria-live="polite" title="The month whose constellations the sky shows">{{ monthLabel }}</b>
            <button type="button" aria-label="Later month" :disabled="shownIndex >= months.length - 1" @click="step(1)">
              ›
            </button>
          </span>
          <span
            v-if="session?.timer?.strictness === 'hard' && session.timer.minutes > 0"
            class="mono"
            title="Emergency passes end a Hard session early. Each one comes back 7 days after it's used."
          >
            Passes left <b>{{ counted(passesLeft) }}</b>
          </span>
          <!-- During a session, only how many are in orbit, not what they say. -->
          <span v-if="session" class="end mono" title="Thoughts you parked. They come back after this session.">
            In orbit <b>{{ counted(satellites.orbiting.length) }}</b>
          </span>
          <button
            v-else-if="hasTasks"
            class="end mono"
            type="button"
            aria-controls="tasks"
            :aria-expanded="showingTasks"
            @click="showingTasks = !showingTasks"
          >
            Tasks <b>{{ counted(taskCount) }}</b> <span class="caret" aria-hidden="true">▾</span>
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <ExploreView
        v-if="exploring"
        :star-count="starCount"
        :stardust="stardust"
        :week-count="weekCount"
        :planet-count="planetCount"
        :zoom="zoom"
        :aimed="aimed"
        :this-week="thisWeek"
        @zoom="emit('zoom', $event)"
        @recenter="emit('recenter')"
        @rename="(id, name) => emit('rename', id, name)"
        @done="exploring = false"
      />
    </Transition>
  </div>
</template>

<style scoped>
.sky-page {
  position: relative;
  flex: 1;
  display: flex;
}

.layer {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform-origin: 50% 60%;
}

.glance {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 0;
}

.glance > span:first-child {
  color: var(--dim);
}

.middle {
  flex: 1;
  display: grid;
  place-items: center;
}

/* Explore on the left, the month in the middle and the tasks on the right. */
.foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}

.foot button {
  padding: 0;
  border-radius: 0;
  background: none;
  transition: color 300ms;
}

.foot > button:first-child {
  justify-self: start;
}

.foot button:hover,
.foot button[aria-expanded='true'] {
  color: var(--starlight);
}

.end {
  grid-column: 3;
  justify-self: end;
}

.caret {
  display: inline-block;
  transition: rotate 400ms var(--ease);
}

[aria-expanded='true'] .caret {
  rotate: 180deg;
}

.months {
  display: flex;
  align-items: center;
  gap: 4px;
}

.months b {
  min-width: 64px;
  text-align: center;
}

.months button {
  width: 18px;
  font-size: 13px;
  line-height: 1;
}

.months button:disabled {
  opacity: 0.3;
  pointer-events: none;
}

/* Long lists scroll inside the drawer, so the profiles stay in the window. */
.tasks {
  max-height: 46vh;
  overflow-y: auto;
  scrollbar-width: none;
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

  .caret {
    transition: none;
  }
}
</style>
