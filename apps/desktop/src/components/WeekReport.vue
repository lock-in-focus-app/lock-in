<script setup lang="ts">
import {
  addWeeks,
  formatDuration,
  formatHour,
  formatHourRange,
  weeklyReport,
  weekStart,
  type SiteDistractions,
  type WeeklyReport,
} from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, ref, watch } from 'vue';
import { activity, firstDayOfWeek } from '../app';
import Unfold from './Unfold.vue';
import WeekPicker from './WeekPicker.vue';

// The weekly report: focus, distractions and satellites for one calendar week, worked out on
// this device from what the app logged. It opens on this week; the arrows go back to earlier
// ones, as far as the log goes. Weeks start on the first day of the week set on the computer.

const firstDay = ref(1);
const ready = ref(false);
const thisWeek = computed(() => weekStart(Date.now(), firstDay.value));
const start = ref(thisWeek.value);
const report = ref<WeeklyReport>();
const firstLoggedAt = ref<number | null>(null);
const error = ref('');
// Whether the calendar for jumping to a week is open.
const picking = ref(false);
const slide = ref<'week-forward' | 'week-back'>('week-forward');
watch(start, (to, from) => (slide.value = to > from ? 'week-forward' : 'week-back'));

const siteName = (recipeId: string) => recipes.find((r) => r.id === recipeId)?.name ?? recipeId;

// Nothing is shown until the first day of the week is known, so the week doesn't jump.
void firstDayOfWeek()
  .catch(() => 1)
  .then((day) => {
    firstDay.value = day;
    start.value = thisWeek.value;
    ready.value = true;
  });

watch([start, ready], async ([week, isReady]) => {
  if (!isReady) return;
  error.value = '';
  try {
    // The week before too, for the trends.
    const logged = await activity(addWeeks(week, -1), addWeeks(week, 1));
    // Skip it if the arrows moved on while it loaded.
    if (week !== start.value) return;
    firstLoggedAt.value = logged.firstLoggedAt;
    report.value = weeklyReport(logged, week, siteName);
  } catch (reason) {
    error.value = `Couldn't load the week: ${String(reason)}`;
  }
});

const firstWeek = computed(() =>
  firstLoggedAt.value === null ? thisWeek.value : weekStart(firstLoggedAt.value, firstDay.value),
);
// No trends against a week before anything was logged.
const hasLastWeek = computed(() => start.value > firstWeek.value);

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const range = computed(() => `${dateFormat.format(start.value)} – ${dateFormat.format(addWeeks(start.value, 1) - 1)}`);
const title = computed(() => {
  if (start.value === thisWeek.value) return 'This week';
  if (start.value === addWeeks(thisWeek.value, -1)) return 'Last week';
  return range.value;
});

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start.value);
    day.setDate(day.getDate() + i);
    return {
      short: day.toLocaleDateString(undefined, { weekday: 'narrow' }),
      long: day.toLocaleDateString(undefined, { weekday: 'long' }),
    };
  }),
);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const barHeight = (value: number, max: number) => (value ? `${Math.max(6, (value / max) * 100)}%` : '2px');

const focus = computed(() => report.value?.focus);
const maxDay = computed(() => Math.max(...(focus.value?.days ?? [0])));
const focusTrend = computed(() => {
  if (!focus.value || !hasLastWeek.value) return '';
  const change = focus.value.focusedMs - focus.value.lastWeekMs;
  if (Math.abs(change) < 60_000) return focus.value.focusedMs ? 'About the same as last week' : '';
  return `${change > 0 ? '↑' : '↓'} ${formatDuration(Math.abs(change))} on last week`;
});
const sessionsLine = computed(() => {
  if (!focus.value) return '';
  const parts = [plural(focus.value.sessions, 'session'), `longest ${formatDuration(focus.value.longestMs)}`];
  if (focus.value.overtimeMs) parts.push(`${formatDuration(focus.value.overtimeMs)} past the timer`);
  return parts.join(' · ');
});
const endings = computed(() => {
  if (!focus.value) return '';
  const { emergencyPasses, idle, broken } = focus.value;
  return [
    emergencyPasses && `${emergencyPasses} ended early with an emergency pass`,
    idle && `${idle} ended while you were away`,
    broken && `${broken} broken by a browser without the extension`,
  ]
    .filter((part) => typeof part === 'string')
    .join(' · ');
});

const distractions = computed(() => report.value?.distractions);
const maxHour = computed(() => Math.max(...(distractions.value?.hours ?? [0])));
const visitsTrend = computed(() => {
  if (!distractions.value || !hasLastWeek.value) return '';
  const change = distractions.value.visits - distractions.value.lastWeekVisits;
  if (!change) return distractions.value.visits ? 'The same as last week' : '';
  return `${Math.abs(change)} ${change > 0 ? 'more' : 'fewer'} than last week`;
});
const siteLine = (site: SiteDistractions) =>
  [
    plural(site.visits, 'trip'),
    site.why && `mostly when ${site.why}`,
    site.peakHour !== undefined && formatHourRange(site.peakHour),
  ]
    .filter((part) => typeof part === 'string')
    .join(' · ');

const satellites = computed(() => report.value?.satellites);
const outcomes = computed(() => {
  if (!satellites.value) return '';
  const { done, tasks, waiting, deleted, snoozes } = satellites.value;
  return [
    done && `${done} done`,
    tasks && `${tasks} on the task list`,
    waiting && `${waiting} still waiting`,
    deleted && `${deleted} deleted`,
    snoozes && `snoozed ${plural(snoozes, 'time')}`,
  ]
    .filter((part) => typeof part === 'string')
    .join(' · ');
});

const empty = computed(() => !focus.value?.sessions && !distractions.value?.visits && !satellites.value?.launched);
</script>

<template>
  <section v-if="ready" class="week" aria-labelledby="week-title">
    <nav class="weeks" aria-label="Weeks">
      <button
        type="button"
        class="arrow"
        aria-label="Week before"
        :disabled="start <= firstWeek"
        @click="start = addWeeks(start, -1)"
      >
        ‹
      </button>
      <h2 id="week-title" class="heading">
        <button
          type="button"
          class="pick"
          aria-haspopup="dialog"
          :aria-expanded="picking"
          title="Pick a week"
          @click="picking = !picking"
        >
          <span>{{ title }} <span class="caret" aria-hidden="true">▾</span></span>
          <span v-if="title !== range" class="dim">{{ range }}</span>
        </button>
      </h2>
      <button
        type="button"
        class="arrow"
        aria-label="Week after"
        :disabled="start >= thisWeek"
        @click="start = addWeeks(start, 1)"
      >
        ›
      </button>
    </nav>
    <Unfold>
      <div v-if="picking" class="picker-space">
        <WeekPicker
          :selected="start"
          :first-day="firstDay"
          :earliest="firstWeek"
          :latest="thisWeek"
          @pick="
            (week: number) => {
              start = week;
              picking = false;
            }
          "
          @close="picking = false"
        />
      </div>
    </Unfold>

    <!-- Weeks slide in from the side of the arrow that was pressed. -->
    <Transition :name="slide" mode="out-in">
      <div :key="report?.start ?? 'loading'">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-else-if="report && empty" class="dim empty">
          Nothing logged
          {{ start === thisWeek ? 'yet this week. Start a session and it will show up here.' : 'that week.' }}
        </p>

        <template v-else-if="report && focus && distractions && satellites">
          <section class="card" aria-labelledby="focus">
            <h3 id="focus">Focus</h3>
            <p class="big">
              {{ formatDuration(focus.focusedMs) }} <span class="dim">focused</span>
              <span v-if="focusTrend" class="trend">{{ focusTrend }}</span>
            </p>
            <ol class="bars days" aria-label="Focus by day">
              <li v-for="(ms, i) in focus.days" :key="i" :title="`${days[i]!.long}: ${formatDuration(ms)}`">
                <span class="track"><span class="bar" :style="{ height: barHeight(ms, maxDay) }" /></span>
                <span class="axis" aria-hidden="true">{{ days[i]!.short }}</span>
                <span class="hidden">{{ days[i]!.long }}: {{ formatDuration(ms) }}</span>
              </li>
            </ol>
            <template v-if="focus.sessions">
              <p class="dim">{{ sessionsLine }}</p>
              <ul class="rows">
                <li v-for="profile in focus.profiles" :key="profile.name">
                  <span>{{ profile.name }}</span>
                  <span class="dim"
                    >{{ formatDuration(profile.focusedMs) }} · {{ plural(profile.sessions, 'session') }}</span
                  >
                </li>
              </ul>
              <p v-if="endings" class="dim">{{ endings }}</p>
            </template>
          </section>

          <section class="card" aria-labelledby="distractions">
            <h3 id="distractions">Distractions</h3>
            <p class="big">
              {{ distractions.visits }}
              <span class="dim">{{ distractions.visits === 1 ? 'trip' : 'trips' }} to redirected sites</span>
              <span v-if="visitsTrend" class="trend">{{ visitsTrend }}</span>
            </p>
            <template v-if="distractions.visits">
              <p class="dim">
                You went back to focus {{ distractions.turnedBack }} of {{ distractions.visits }} times.
              </p>
              <ol class="bars hours" aria-label="Trips by time of day">
                <li
                  v-for="(count, hour) in distractions.hours"
                  :key="hour"
                  :title="`${formatHour(hour)}: ${plural(count, 'trip')}`"
                >
                  <span class="track"><span class="bar" :style="{ height: barHeight(count, maxHour) }" /></span>
                  <span class="hidden">{{ formatHour(hour) }}: {{ plural(count, 'trip') }}</span>
                </li>
              </ol>
              <p class="hour-axis dim" aria-hidden="true">
                <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span>
              </p>
              <ul class="rows">
                <li v-for="site in distractions.sites" :key="site.recipeId">
                  <span>{{ siteName(site.recipeId) }}</span>
                  <span class="dim">{{ siteLine(site) }}</span>
                </li>
              </ul>
              <p v-if="distractions.whys.length" class="dim">
                Why: {{ distractions.whys.map((w) => `${w.why} ${w.visits}`).join(' · ') }}
              </p>
              <template v-if="distractions.intentions.length">
                <p class="dim">What you came for</p>
                <ul class="rows">
                  <li v-for="intention in distractions.intentions" :key="intention.text">
                    <span class="intention">{{ intention.text }}</span>
                    <span v-if="intention.count > 1" class="dim">×{{ intention.count }}</span>
                  </li>
                </ul>
              </template>
            </template>
          </section>

          <section class="card" aria-labelledby="satellites">
            <h3 id="satellites">Satellites</h3>
            <p class="big">{{ satellites.launched }} <span class="dim">launched</span></p>
            <p v-if="outcomes" class="dim">{{ outcomes }}</p>
          </section>

          <section v-if="report.suggestions.length" class="card" aria-labelledby="suggestions">
            <h3 id="suggestions">Suggestions</h3>
            <ul class="tips">
              <li v-for="tip in report.suggestions" :key="tip">{{ tip }}</li>
            </ul>
          </section>
        </template>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.picker-space {
  padding-top: 12px;
}

.week-forward-enter-active,
.week-back-enter-active {
  transition:
    opacity 360ms ease,
    transform 460ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 360ms ease;
}

.week-forward-leave-active,
.week-back-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms ease-in,
    filter 180ms ease;
}

.week-forward-enter-from,
.week-back-leave-to {
  opacity: 0;
  transform: translateX(28px);
  filter: blur(3px);
}

.week-forward-leave-to,
.week-back-enter-from {
  opacity: 0;
  transform: translateX(-28px);
  filter: blur(3px);
}

@media (prefers-reduced-motion: reduce) {
  .week-forward-enter-from,
  .week-forward-leave-to,
  .week-back-enter-from,
  .week-back-leave-to {
    transform: none;
    filter: none;
  }
}

.weeks {
  display: flex;
  align-items: center;
  gap: 8px;
}

.heading {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.pick {
  display: grid;
  width: 100%;
  padding: 4px 8px;
  border-radius: 8px;
  background: none;
  font-weight: inherit;
}

.pick:hover,
.pick[aria-expanded='true'] {
  background: var(--sky-raised);
}

.pick .dim {
  font-weight: 400;
}

.caret {
  color: var(--dim);
  font-size: 13px;
}

.arrow {
  width: 32px;
  height: 32px;
  background: var(--sky-raised);
  font-size: 18px;
}

.arrow:hover:not(:disabled) {
  background: var(--sky-hover);
}

.arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

section section {
  margin-top: 12px;
  padding: 14px 16px;
}

h3 {
  margin: 0 0 6px;
  color: var(--dim);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

p {
  margin: 6px 0 0;
}

.dim {
  color: var(--dim);
  font-size: 12px;
}

.big {
  font-size: 20px;
  font-weight: 600;
}

.big .dim {
  font-weight: 400;
}

.trend {
  display: block;
  color: var(--dim);
  font-size: 12px;
  font-weight: 400;
}

.empty {
  margin-top: 24px;
  text-align: center;
}

.bars {
  display: grid;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.days {
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.hours {
  grid-template-columns: repeat(24, 1fr);
  gap: 2px;
}

.bars li {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 56px;
}

.hours .track {
  height: 32px;
}

.bar {
  width: 100%;
  border-radius: 3px;
  background: var(--glow);
}

.axis {
  color: var(--dim);
  font-size: 11px;
}

.hour-axis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 2px;
  font-size: 10px;
}

.rows {
  display: grid;
  gap: 2px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.rows li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--sky-raised);
}

.rows .dim {
  text-align: right;
}

.intention {
  overflow-wrap: anywhere;
}

.tips {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tips li {
  padding: 10px 12px;
  border-left: 2px solid var(--glow);
  border-radius: 0 8px 8px 0;
  background: var(--sky-raised);
}

.error {
  color: #f0a3a3;
  font-size: 12px;
}

/* Read out by screen readers, in place of the bars. */
.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
