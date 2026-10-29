<script setup lang="ts">
import type { SessionGoal } from '@lock-in/core';

// "Did you do it?" for the last session's goal (PLAN §7): a quiet strip at the top of the Sky
// between sessions, waiting until it's answered or the next session starts. It never pops up;
// the answer goes to the weekly report.
defineProps<{ goal: SessionGoal; profileName: string; color: string }>();
const emit = defineEmits<{ answer: [met: boolean] }>();
</script>

<template>
  <section class="card check" :style="{ '--c': color }" aria-labelledby="did-you-do-it">
    <p class="mono"><span class="dot" aria-hidden="true" />{{ profileName }} · Your goal</p>
    <p class="goal">{{ goal.text }}</p>
    <div class="row">
      <span id="did-you-do-it" class="mono">Did you do it?</span>
      <span class="keys">
        <button class="key" type="button" @click="emit('answer', true)">Yes, I did</button>
        <button class="key" type="button" @click="emit('answer', false)">Not this time</button>
      </span>
    </div>
  </section>
</template>

<style scoped>
.check {
  display: grid;
  gap: 3px;
  margin-top: 4px;
  padding: 8px 8px 7px 11px;
}

p {
  margin: 0;
}

.mono:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}

.goal {
  font-size: 13px;
  overflow-wrap: anywhere;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.keys {
  display: flex;
  gap: 6px;
  white-space: nowrap;
}
</style>
