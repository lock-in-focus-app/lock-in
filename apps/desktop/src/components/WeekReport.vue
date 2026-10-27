<script setup lang="ts">
import {
  addWeeks,
  formatDuration,
  formatHour,
  formatHourRange,
  maxConstellationNameLength,
  weeklyReport,
  weekStart,
  type Comet,
  type RareEvent,
  type SiteDistractions,
  type WeeklyReport,
} from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import { computed, nextTick, ref, watch } from 'vue';
import { activity } from '../app';
import DotChart from './DotChart.vue';
import Unfold from './Unfold.vue';
import WeekPicker from './WeekPicker.vue';

// The weekly report: focus, distractions and satellites for one calendar week, worked out on
// this device from what the app logged. It opens on this week; the arrows go back to earlier
// ones, as far as the log goes. Weeks start on the first day of the week set on the computer.
// The week's constellation shows softly behind the header (drawn by the sky), named beneath it.
// Anything rare that happened in the sky that week is noted quietly at the end.

const props = defineProps<{
  /** The first day of the week, 0 being Sunday. */
  firstDay: number;
  /** The constellation of the week being shown, if it has one. */
  constellation?: { id: string; name: string; named: boolean };
  /** Every rare event and comet, oldest first. */
  events: RareEvent[];
  comets: Comet[];
}>();
const emit = defineEmits<{
  /** The start of the week being shown, whenever it changes. */
  week: [start: number];
  rename: [id: string, name: string];
}>();

const thisWeek = computed(() => weekStart(Date.now(), props.firstDay));
const start = ref(thisWeek.value);
const report = ref<WeeklyReport>();
const firstLoggedAt = ref<number | null>(null);
const error = ref('');
// Whether the calendar for jumping to a week is open.
const picking = ref(false);
const slide = ref<'week-forward' | 'week-back'>('week-forward');
watch(start, (to, from) => (slide.value = to > from ? 'week-forward' : 'week-back'));

const siteName = (recipeId: string) => recipes.find((r) => r.id === recipeId)?.name ?? recipeId;

watch(start, (week) => emit('week', week), { immediate: true });

watch(
  start,
  async (week) => {
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
  },
  { immediate: true },
);

// Renaming the week's constellation, in place.
const renaming = ref(false);
const draft = ref('');
const nameInput = ref<HTMLInputElement>();
async function startRenaming() {
  draft.value = props.constellation?.named ? props.constellation.name : '';
  renaming.value = true;
  await nextTick();
  nameInput.value?.focus();
}
function saveName() {
  if (!renaming.value) return;
  renaming.value = false;
  const constellation = props.constellation;
  if (constellation && draft.value.trim() !== (constellation.named ? constellation.name : '')) {
    emit('rename', constellation.id, draft.value);
  }
}
watch(start, () => (renaming.value = false));

const firstWeek = computed(() =>
  firstLoggedAt.value === null ? thisWeek.value : weekStart(firstLoggedAt.value, props.firstDay),
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

const focus = computed(() => report.value?.focus);
// The busiest day, named above its dots, when the week had any focus.
const peakDay = computed(() => {
  const week = focus.value?.days ?? [];
  const most = Math.max(0, ...week);
  return most > 0 ? `Peak: ${days.value[week.indexOf(most)]!.long}` : undefined;
});
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

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
const month = new Intl.DateTimeFormat(undefined, { month: 'long' });
const inWeek = (at: number) => at >= start.value && at < addWeeks(start.value, 1);
/** What happened and on which day, e.g. "An aurora, for your longest session yet" on "Friday". */
function eventLine(event: RareEvent) {
  const planet = `${month.format(event.at)}'s planet`;
  const what = {
    shootingStar: 'a shooting star',
    meteorShower: 'a meteor shower',
    aurora: 'an aurora',
    supernova: 'a supernova',
    moonCrash: `a moon crashed into ${planet}`,
    split: `a chunk broke off ${planet}`,
    shatter: `${planet} shattered into a ring of debris`,
  }[event.kind];
  const why =
    event.reason === 'longestSession'
      ? ', for your longest session yet'
      : event.reason === 'longestStreak'
        ? `, for your longest streak yet: ${event.streakDays} days in a row`
        : '';
  return { id: event.id, what: `${what[0]!.toUpperCase()}${what.slice(1)}${why}`, day: weekday.format(event.at) };
}
const skyLines = computed(() => props.events.filter((event) => inWeek(event.at)).map(eventLine));
const weekComets = computed(() => props.comets.filter((comet) => inWeek(comet.at)).length);

const empty = computed(() => !focus.value?.sessions && !distractions.value?.visits && !satellites.value?.launched);
</script>

<template>
  <section class="week" aria-labelledby="week-title">
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
    <Transition name="fade" mode="out-in">
      <div v-if="constellation" :key="constellation.id" class="constellation">
        <form v-if="renaming" class="rename" @submit.prevent="saveName">
          <input
            ref="nameInput"
            v-model="draft"
            :maxlength="maxConstellationNameLength"
            :placeholder="constellation.named ? 'A made-up name' : constellation.name"
            aria-label="This week's constellation"
            @keydown.esc.prevent="renaming = false"
            @blur="saveName"
          />
        </form>
        <button v-else type="button" class="name" title="Name this week's constellation" @click="startRenaming">
          <span class="star" aria-hidden="true">✦</span> {{ constellation.name }}
          <span class="edit">Rename</span>
        </button>
      </div>
    </Transition>
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
            <DotChart
              label="Focus by day"
              :values="focus.days"
              :titles="focus.days.map((ms, i) => `${days[i]!.long}: ${formatDuration(ms)}`)"
              :labels="days.map((day) => day.short)"
              :peak="peakDay"
              :rows="6"
              :across="3"
              color="var(--glow)"
            />
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
              <DotChart
                label="Trips by time of day"
                :values="distractions.hours"
                :titles="distractions.hours.map((count, hour) => `${formatHour(hour)}: ${plural(count, 'trip')}`)"
                :rows="4"
                color="#f2a7c3"
              />
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

          <section v-if="skyLines.length || weekComets" class="card" aria-labelledby="in-the-sky">
            <h3 id="in-the-sky">In the sky</h3>
            <ul class="rows">
              <li v-for="line in skyLines" :key="line.id">
                <span>{{ line.what }}</span>
                <span class="dim">{{ line.day }}</span>
              </li>
            </ul>
            <p v-if="weekComets" class="dim">{{ plural(weekComets, 'comet') }} for going back to focus</p>
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
.constellation {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

.name {
  padding: 3px 10px;
  border-radius: 999px;
  background: none;
  color: var(--starlight);
  font-size: 12px;
  letter-spacing: 0.02em;
  text-shadow: 0 0 10px rgb(6 9 20 / 0.9);
  transition: background 300ms;
}

.name .star {
  color: var(--glow);
}

.edit {
  margin-left: 4px;
  color: var(--dim);
  opacity: 0;
  transition: opacity 300ms;
}

.name:hover,
.name:focus-visible {
  background: rgb(255 255 255 / 0.07);
}

.name:hover .edit,
.name:focus-visible .edit {
  opacity: 1;
}

.rename input {
  width: 220px;
  padding: 3px 10px;
  border: 1px solid rgb(205 215 255 / 0.2);
  border-radius: 999px;
  background: var(--sky-raised);
  color: var(--starlight);
  font: inherit;
  font-size: 12px;
  text-align: center;
  outline: none;
  transition:
    border-color 300ms,
    box-shadow 300ms;
}

.rename input:focus {
  border-color: rgb(205 215 255 / 0.4);
  box-shadow: 0 0 12px -2px rgb(160 180 255 / 0.35);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 400ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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
</style>
