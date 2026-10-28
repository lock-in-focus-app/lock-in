<script setup lang="ts">
import type { ProfileSummary, Strictness } from '@lock-in/core';
import { starColorFor } from '@lock-in/core';

// The row of profiles along the bottom of the sky. Each one spells out how its session works and
// starts it; this is the only place the window starts sessions (PLAN §5, the Sky page).
defineProps<{ profiles: ProfileSummary[]; firstStar: boolean }>();
const emit = defineEmits<{ start: [profileId: string] }>();

const strictness: Record<Strictness, string> = { gentle: 'Gentle', medium: 'Medium', hard: 'Hard' };
</script>

<template>
  <section class="dock" aria-labelledby="start-a-session">
    <div class="label">
      <span id="start-a-session" class="mono">▶ Start a session</span>
      <span class="mono">{{ firstStar ? 'First star after 5 min of focus' : 'Pick a profile' }}</span>
    </div>
    <div class="profiles" :style="{ '--columns': Math.min(3, profiles.length) }">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        class="card profile"
        type="button"
        :title="`Start a ${profile.name} session`"
        :style="{ '--c': starColorFor(profile.id, profile.starColor) }"
        @click="emit('start', profile.id)"
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
</style>
