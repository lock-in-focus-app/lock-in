<script setup lang="ts">
import { addWeeks, weekStart } from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import { activity } from '../app';

// A month calendar for jumping to a week in the report: each row is a week, starting on the
// first day of the week set on the computer. Days with a session get a dot, so it's easy to
// see which weeks have something in them.
const props = defineProps<{
  /** The start of the week being shown. */
  selected: number;
  firstDay: number;
  /** The start of the first week that can be picked, and of the last. */
  earliest: number;
  latest: number;
}>();
const emit = defineEmits<{ pick: [weekStart: number]; close: [] }>();

const firstOfMonth = (at: number) => {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
};
const addMonths = (month: number, count: number) => {
  const date = new Date(month);
  return new Date(date.getFullYear(), date.getMonth() + count, 1).getTime();
};

const month = ref(firstOfMonth(props.selected));
const nextMonth = computed(() => addMonths(month.value, 1));
const slide = ref<'month-forward' | 'month-back'>('month-forward');
watch(month, (to, from) => (slide.value = to > from ? 'month-forward' : 'month-back'));
const title = computed(() => new Date(month.value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

/** The weeks that touch the month, each with its seven days. */
const weeks = computed(() => {
  const rows: { start: number; days: Date[] }[] = [];
  for (let start = weekStart(month.value, props.firstDay); start < nextMonth.value; start = addWeeks(start, 1)) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      return day;
    });
    rows.push({ start, days });
  }
  return rows;
});
const weekdays = computed(() =>
  weeks.value[0]!.days.map((day) => day.toLocaleDateString(undefined, { weekday: 'narrow' })),
);

const dayKey = (day: Date) => `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
const today = dayKey(new Date());
const focusedDays = ref(new Set<string>());
watch(
  weeks,
  async (rows) => {
    const from = rows[0]!.start;
    const to = addWeeks(rows[rows.length - 1]!.start, 1);
    try {
      const logged = await activity(from, to);
      if (weeks.value !== rows) return;
      focusedDays.value = new Set(logged.sessions.map((s) => dayKey(new Date(s.startedAt))));
    } catch {
      // The dots are only a hint, so the calendar works without them.
      focusedDays.value = new Set();
    }
  },
  { immediate: true },
);

const canPick = (start: number) => start >= props.earliest && start <= props.latest;
const weekLabel = (start: number) =>
  `Week of ${new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
</script>

<template>
  <div class="card picker" role="dialog" aria-label="Pick a week" @keydown.esc.stop="emit('close')">
    <div class="months">
      <button
        type="button"
        class="arrow"
        aria-label="Month before"
        :disabled="month <= earliest"
        @click="month = addMonths(month, -1)"
      >
        ‹
      </button>
      <span class="month">{{ title }}</span>
      <button
        type="button"
        class="arrow"
        aria-label="Month after"
        :disabled="nextMonth > latest"
        @click="month = nextMonth"
      >
        ›
      </button>
    </div>
    <div class="row weekdays" aria-hidden="true">
      <span v-for="(weekday, i) in weekdays" :key="i">{{ weekday }}</span>
    </div>
    <!-- Months slide in from the side of the arrow that was pressed. -->
    <Transition :name="slide" mode="out-in">
      <div :key="month" class="weeks">
        <button
          v-for="week in weeks"
          :key="week.start"
          type="button"
          class="row week"
          :class="{ selected: week.start === selected }"
          :aria-label="weekLabel(week.start)"
          :aria-current="week.start === selected ? 'true' : undefined"
          :disabled="!canPick(week.start)"
          @click="emit('pick', week.start)"
        >
          <span
            v-for="day in week.days"
            :key="day.getTime()"
            class="day"
            :class="{
              outside: day.getMonth() !== new Date(month).getMonth(),
              today: dayKey(day) === today,
              focused: focusedDays.has(dayKey(day)),
            }"
          >
            {{ day.getDate() }}
          </span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 2px;
  padding: 12px;
}

.weeks {
  display: grid;
  gap: 2px;
}

.month-forward-enter-active,
.month-back-enter-active {
  transition:
    opacity 320ms ease,
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.month-forward-leave-active,
.month-back-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease-in;
}

.month-forward-enter-from,
.month-back-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.month-forward-leave-to,
.month-back-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

@media (prefers-reduced-motion: reduce) {
  .month-forward-enter-from,
  .month-forward-leave-to,
  .month-back-enter-from,
  .month-back-leave-to {
    transform: none;
  }
}

.months {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.month {
  flex: 1;
  text-align: center;
  font-weight: 600;
}

.arrow {
  width: 28px;
  height: 28px;
  background: none;
  font-size: 16px;
}

.arrow:hover:not(:disabled) {
  background: var(--sky-hover);
}

.arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.weekdays {
  color: var(--dim);
  font-size: 11px;
}

.week {
  padding: 4px 0;
  border-radius: 8px;
  background: none;
}

.week:hover:not(:disabled) {
  background: var(--sky-hover);
}

.week.selected {
  background: var(--sky-hover);
  box-shadow: inset 0 0 0 1px var(--glow);
}

.week:disabled {
  opacity: 0.35;
  cursor: default;
}

.day {
  position: relative;
  padding-bottom: 6px;
  font-size: 13px;
}

.day.outside {
  color: var(--dim);
}

.day.today {
  color: var(--glow);
  font-weight: 600;
}

/* A dot under days with a session. */
.day.focused::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: var(--glow);
}
</style>
