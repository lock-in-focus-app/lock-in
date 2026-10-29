<script setup lang="ts">
import type { ProfileSummary, Strictness } from '@lock-in/core';
import { maxGoalLength, starColorFor } from '@lock-in/core';
import { nextTick, ref, useTemplateRef } from 'vue';

// The row of profiles along the bottom of the sky. Each one spells out how its session works and
// starts it; this is the only place the window starts sessions (PLAN §5, the Sky page). A profile
// that asks for a goal (PLAN §7) turns the row into one line for it first, which can be left empty.
defineProps<{ profiles: ProfileSummary[]; firstStar: boolean }>();
const emit = defineEmits<{ start: [profileId: string, goal?: string] }>();

const strictness: Record<Strictness, string> = { gentle: 'Gentle', medium: 'Medium', hard: 'Hard' };

const asking = ref<ProfileSummary>();
const goal = ref('');
const goalField = useTemplateRef<HTMLInputElement>('goalField');

async function pick(profile: ProfileSummary) {
  if (!profile.askGoal) {
    emit('start', profile.id);
    return;
  }
  goal.value = '';
  asking.value = profile;
  await nextTick();
  goalField.value?.focus();
}

function start() {
  if (!asking.value) return;
  emit('start', asking.value.id, goal.value.trim() || undefined);
  asking.value = undefined;
}
</script>

<template>
  <section class="dock" aria-labelledby="start-a-session" data-tour="start">
    <div class="label">
      <span id="start-a-session" class="mono">▶ Start a session</span>
      <span class="mono">{{ firstStar ? 'First star after 5 min of focus' : 'Pick a profile' }}</span>
    </div>
    <form
      v-if="asking"
      class="card goal"
      :style="{ '--c': starColorFor(asking.id, asking.starColor) }"
      @submit.prevent="start"
      @keydown.esc="asking = undefined"
    >
      <label class="mono" for="session-goal">
        <span class="dot" aria-hidden="true" /><b>{{ asking.name }}</b> · What will you get done?
      </label>
      <!-- An input can't draw the frame's corner ticks itself, so a label around it does. -->
      <label class="card box">
        <input
          id="session-goal"
          ref="goalField"
          v-model="goal"
          :maxlength="maxGoalLength"
          placeholder="One thing, like “Draft the intro”"
        />
      </label>
      <span class="choices">
        <button class="card mono" type="button" @click="asking = undefined">‹ Back</button>
        <button class="card mono go" type="submit">{{ goal.trim() ? '▶ Start' : '▶ Start without a goal' }}</button>
      </span>
    </form>
    <div v-else class="profiles" :style="{ '--columns': Math.min(3, profiles.length) }">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        class="card profile"
        type="button"
        :title="`Start a ${profile.name} session`"
        :style="{ '--c': starColorFor(profile.id, profile.starColor) }"
        @click="pick(profile)"
      >
        <span class="name"><span class="dot" aria-hidden="true" />{{ profile.name }}</span>
        <span class="mono">
          <template v-if="profile.timer.minutes > 0">
            {{ profile.timer.minutes }} min<br />{{ strictness[profile.timer.strictness] }}
          </template>
          <template v-else>No timer</template>
        </span>
        <span class="start mono" aria-hidden="true">▶ Start</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.dock {
  display: grid;
  gap: 10px;
}

.label {
  display: flex;
  justify-content: space-between;
}

.label :first-child {
  color: var(--dim);
}

.profiles {
  display: grid;
  grid-template-columns: repeat(var(--columns), 1fr);
  gap: 8px;
}

.profile {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 12px 10px 9px;
  background: none;
  text-align: left;
}

.name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.start {
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px dashed var(--line);
  color: var(--dim);
  transition:
    color 300ms,
    text-shadow 300ms;
}

.name + .mono {
  margin-bottom: 7px;
}

.profile:hover .start,
.profile:focus-visible .start {
  color: var(--c);
  text-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent);
}

.profile:active {
  scale: 0.98;
}

/* The goal for a profile that asks for one, in place of the row. */
.goal {
  display: grid;
  gap: 8px;
  padding: 12px 10px 10px;
}

.goal .mono:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}

.box {
  display: flex;
}

.box:focus-within {
  --t: var(--tick-bright);
}

.box input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 0;
  outline: 0;
  background: none;
  color: var(--starlight);
  font:
    12.5px system-ui,
    sans-serif;
}

.choices {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.choices button {
  padding: 6px 10px;
  background: none;
  color: var(--dim);
  transition: color 300ms;
}

.choices button:hover,
.choices .go {
  color: var(--starlight);
}

.choices .go:hover {
  color: var(--c);
  text-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent);
}
</style>
