<script setup lang="ts">
import type { ProfileSummary } from '@lock-in/core';
import { starColorFor } from '@lock-in/core';
import { vTilt } from '../tilt';

// The row of profiles along the bottom of the sky. Tapping one locks in; this is the only place
// the window starts sessions (PLAN §5, the Sky page).
defineProps<{ profiles: ProfileSummary[] }>();
const emit = defineEmits<{ start: [profileId: string] }>();
</script>

<template>
  <section class="dock" aria-label="Start a session">
    <button
      v-for="profile in profiles"
      :key="profile.id"
      v-tilt
      class="launch"
      type="button"
      :title="`Lock in with ${profile.name}`"
      :style="{ '--star': starColorFor(profile.id, profile.starColor) }"
      @click="emit('start', profile.id)"
    >
      <span class="star" aria-hidden="true">✦</span>
      <span class="name">{{ profile.name }}</span>
      <span class="length">{{ profile.timer.minutes > 0 ? `${profile.timer.minutes} min` : 'No timer' }}</span>
    </button>
  </section>
</template>

<style scoped>
.dock {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.launch {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  gap: 0 6px;
  padding: 9px 12px;
  border-radius: 14px;
  background: none;
  text-align: left;
}

/* A soft glow in the profile's star color under the pointer's sheen, brighter on hover. */
.launch::after {
  background:
    radial-gradient(circle at var(--sheen-x, 50%) var(--sheen-y, 0%), rgb(255 255 255 / 0.08), transparent 65%),
    radial-gradient(circle at 18% 50%, color-mix(in srgb, var(--star) 28%, transparent), transparent 70%);
  opacity: 0.7;
}

.launch:hover::after {
  opacity: 1;
}

.launch:active {
  scale: 0.97;
}

.star {
  grid-row: span 2;
  color: var(--star);
  align-self: center;
  font-size: 15px;
  text-shadow: 0 0 8px currentColor;
}

.name {
  font-weight: 600;
}

.length {
  grid-column: 2;
  color: var(--dim);
  font-size: 12px;
}
</style>
