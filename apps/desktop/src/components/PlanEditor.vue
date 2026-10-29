<script setup lang="ts">
import { maxPlanLength } from '@lock-in/core';
import { ref, watch } from 'vue';

// A profile's if-then plan, which its redirect page shows each time (PLAN §3). It's typed here
// and saved when the box is left or Enter is pressed, so each keystroke isn't a save. The
// same plan can be changed in the extension's settings.
const props = defineProps<{ plan: string }>();
const emit = defineEmits<{ 'update:plan': [plan: string] }>();

const draft = ref(props.plan);
watch(
  () => props.plan,
  (saved) => (draft.value = saved),
);

function save() {
  if (draft.value.trim() !== props.plan) emit('update:plan', draft.value.trim());
}
</script>

<template>
  <div class="plan">
    <!-- A text box can't draw the frame's corner ticks itself, so a label around it does. -->
    <label class="card box">
      <textarea
        v-model="draft"
        aria-label="If-then plan"
        placeholder="When I want Reddit, I'll write one paragraph first."
        rows="2"
        :maxlength="maxPlanLength"
        @blur="save"
        @keydown.enter.exact.prevent="($event.target as HTMLTextAreaElement).blur()"
      />
    </label>
    <p class="help">
      Decide now what you'll do when the urge comes, and the redirect page shows it to you each time you reach for a
      redirected site. Planning "when this happens, I'll do that" ahead of time is one of the best-tested ways to change
      a habit.
    </p>
  </div>
</template>

<style scoped>
.plan {
  padding-top: 10px;
}

.box {
  display: flex;
}

.box:focus-within {
  --t: var(--tick-bright);
}

textarea {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 0;
  outline: 0;
  background: none;
  color: var(--starlight);
  font:
    12.5px/1.5 system-ui,
    sans-serif;
  resize: none;
}

textarea::placeholder {
  color: var(--faint);
}

.help {
  margin: 10px 0 4px;
  color: var(--faint);
  font-size: 11.5px;
}
</style>
