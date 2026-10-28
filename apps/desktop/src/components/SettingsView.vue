<script setup lang="ts">
import type { KnownBrowser, Settings } from '@lock-in/core';
import NumberField from './NumberField.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{
  settings: Settings;
  passesLeft: number;
  browsers: KnownBrowser[];
  sessionRunning: boolean;
}>();
const emit = defineEmits<{
  'update:settings': [settings: Settings];
  'forget-browser': [path: string];
  'sample-data': [action: 'add' | 'remove'];
  close: [];
}>();
// Sample data is for trying the app while developing it, so release builds don't offer it.
const development = import.meta.env.DEV;

function save(patch: Partial<Settings>) {
  emit('update:settings', { ...props.settings, ...patch });
}
</script>

<template>
  <section class="settings">
    <div class="card group">
      <h2>Sessions</h2>
      <div class="row">
        <span>Emergency passes per week</span>
        <NumberField
          label="Emergency passes per week"
          unit="passes"
          :min="0"
          :max="14"
          :model-value="settings.passesPerWeek"
          @update:model-value="save({ passesPerWeek: $event })"
        />
      </div>
      <p class="help">
        For ending a Hard session before its timer is done. Each one comes back 7 days after it's used.
        {{ passesLeft }} left right now. During a Hard session this can only go down.
      </p>

      <div class="row">
        <span>End a session after</span>
        <NumberField
          label="Minutes away before a session ends"
          unit="min away"
          :min="0"
          :max="120"
          :model-value="settings.idleMinutes"
          @update:model-value="save({ idleMinutes: $event })"
        />
      </div>
      <p class="help">
        With no keyboard or mouse input for this long, a session ends by itself, and the time away isn't counted. 0
        turns this off.
      </p>
    </div>

    <div class="card group">
      <h2>Browsers</h2>
      <ul v-if="browsers.length" class="browsers">
        <li v-for="browser in browsers" :key="browser.path" class="row">
          <span :title="browser.path">{{ browser.name }}</span>
          <button
            class="forget"
            type="button"
            :disabled="sessionRunning"
            :aria-label="`Forget ${browser.name}`"
            @click="emit('forget-browser', browser.path)"
          >
            Forget
          </button>
        </li>
      </ul>
      <p v-else class="none">None yet. Browsers show up here once the Lock In extension links to this app.</p>
      <p class="help">
        During a session whose profile tames sites, if one of these runs without the extension, Lock In warns you.
        {{
          sessionRunning
            ? 'Browsers can be forgotten once this session ends.'
            : "Forget a browser you've stopped using."
        }}
      </p>

      <ToggleSwitch
        label="Close browsers without the extension"
        :model-value="settings.closeBrowsers"
        @update:model-value="save({ closeBrowsers: $event })"
      />
      <p class="help">
        In a Medium session, the browser closes a minute after the warning. In Hard, the session also counts as broken.
        During a Hard session this can't be turned off.
      </p>
    </div>

    <div class="card group">
      <h2>Sky</h2>
      <ToggleSwitch
        label="Battery saver"
        :model-value="settings.batterySaver"
        @update:model-value="save({ batterySaver: $event })"
      />
      <p class="help">
        The stars twinkle 30 times a second instead of 60, so they're a little less smooth. Either way, the sky pauses
        while this window isn't the one you're using, and stops when it's closed.
      </p>
    </div>

    <div v-if="development" class="card group">
      <h2>Sample data</h2>
      <div class="row">
        <span>Six weeks of made-up sessions</span>
        <span class="buttons">
          <button class="small" type="button" @click="emit('sample-data', 'add')">Add</button>
          <button class="small" type="button" @click="emit('sample-data', 'remove')">Remove</button>
        </span>
      </div>
      <p class="help">
        For trying the sky and the weekly report. Only in development builds. Sample sessions are marked, so Remove
        takes them all out and leaves your own.
      </p>
    </div>

    <button class="done" type="button" @click="emit('close')">Done</button>
  </section>
</template>

<style scoped>
.settings {
  display: grid;
  gap: 12px;
}

.group {
  padding: 4px 14px 2px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.help {
  margin: 0 0 16px;
  color: var(--dim);
  font-size: 12px;
}

h2 {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 600;
}

.browsers {
  margin: 0;
  padding: 0;
  list-style: none;
}

.none {
  margin: 0 0 4px;
  font-size: 13px;
}

.buttons {
  display: flex;
  gap: 4px;
}

.forget,
.small {
  padding: 4px 10px;
  background: var(--sky-raised);
  font-size: 12px;
}

.small:hover,
.forget:hover:not(:disabled) {
  background: var(--sky-hover);
}

.forget:disabled {
  opacity: 0.5;
  cursor: default;
}

.done {
  width: 100%;
  padding: 10px;
  background: var(--sky-raised);
}

.done:hover {
  background: var(--sky-hover);
}
</style>
