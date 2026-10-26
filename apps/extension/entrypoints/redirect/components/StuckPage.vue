<script lang="ts" setup>
import { computed, ref } from 'vue';

const emit = defineEmits<{ back: [] }>();

// Nothing typed here is saved. It's only for the user.
const steps = [
  {
    title: 'Say it out loud',
    body: "Explain where you're stuck in one sentence, as if to a friend.",
    placeholder: "I'm stuck because…",
  },
  {
    title: 'Shrink it',
    body: "What's the smallest next step? Something you could finish in five minutes.",
    placeholder: 'My next step is…',
  },
  {
    title: 'Stand up',
    body: 'Stretch your arms overhead, roll your shoulders, and look at something far away for a few seconds.',
  },
  {
    title: 'Breathe',
    body: 'Breathe in as the circle grows and out as it shrinks. Three slow breaths.',
    breathe: true,
  },
];

const index = ref(0);
const answers = ref<string[]>(steps.map(() => ''));
const step = computed(() => steps[index.value]);
const nextStep = computed(() => answers.value[1]?.trim());
</script>

<template>
  <p class="eyebrow">A 2-minute unstick</p>

  <template v-if="step">
    <ol class="progress" aria-hidden="true">
      <li v-for="(_, i) in steps" :key="i" :class="{ done: i <= index }" />
    </ol>
    <h1>{{ step.title }}</h1>
    <p class="body">{{ step.body }}</p>
    <input
      v-if="step.placeholder"
      v-model="answers[index]"
      :aria-label="step.title"
      :placeholder="step.placeholder"
      autofocus
      @keydown.enter="index++"
    />
    <div v-if="step.breathe" class="breath" aria-hidden="true" />
    <button type="button" class="secondary next" @click="index++">
      {{ index === steps.length - 1 ? 'Done' : 'Next' }}
    </button>
  </template>

  <template v-else>
    <h1>Ready when you are</h1>
    <p class="body">
      <template v-if="nextStep"
        >Your next step: <strong>{{ nextStep }}</strong></template
      >
      <template v-else>Pick the smallest piece of the task and start there.</template>
    </p>
    <button type="button" class="primary" @click="emit('back')">Back to focus</button>
  </template>
</template>

<style scoped>
.eyebrow {
  margin: 0 0 12px;
  color: var(--glow);
  font-size: 12px;
}

.progress {
  display: flex;
  gap: 6px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.progress li {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: var(--sky-hover);
  transition: background 300ms;
}

.progress li.done {
  background: var(--glow);
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
}

.body {
  margin: 8px 0 20px;
  color: var(--dim);
  font-size: 15px;
}

.body strong {
  color: var(--starlight);
  font-weight: 500;
}

input {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--sky-hover);
  border-radius: 10px;
  background: var(--sky-raised);
  color: var(--starlight);
  font: inherit;
  font-size: 15px;
}

input:focus {
  border-color: var(--glow);
  outline: none;
}

.breath {
  width: 120px;
  height: 120px;
  margin: 8px auto 28px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--glow) 55%, transparent), transparent 70%);
  animation: breathe 8s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(0.55);
  }
  50% {
    transform: scale(1);
  }
}

.next {
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .breath {
    animation: none;
    transform: scale(0.8);
  }
}
</style>
