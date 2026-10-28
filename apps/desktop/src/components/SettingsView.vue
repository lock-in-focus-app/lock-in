<script setup lang="ts">
import type { KnownBrowser, Settings } from '@lock-in/core';
import { glowFor, nextGlow, unlockedGlows } from '@lock-in/core';
import { computed } from 'vue';
import { mac } from '../app';
import GlowPicker from './GlowPicker.vue';
import HotkeyField from './HotkeyField.vue';
import NumberField from './NumberField.vue';
import ToggleSwitch from './ToggleSwitch.vue';

const props = defineProps<{
  settings: Settings;
  passesLeft: number;
  browsers: KnownBrowser[];
  sessionRunning: boolean;
  /** All the time ever focused, which unlocks glow colors. */
  lifetimeFocusMs: number;
}>();
const emit = defineEmits<{
  'update:settings': [settings: Settings];
  'forget-browser': [path: string];
  'sample-data': [action: 'add' | 'remove'];
  close: [];
}>();
// Sample data is for trying the app while developing it, so release builds don't offer it.
const development = import.meta.env.DEV;

// The sections are numbered in order, like the weekly report's.
const sections = ['sessions', 'satellites', 'browsers', 'sky', 'glow', ...(development ? ['sample'] : [])];
const numbered = (section: string) => String(sections.indexOf(section) + 1).padStart(2, '0');

function save(patch: Partial<Settings>) {
  emit('update:settings', { ...props.settings, ...patch });
}

// Glow colors come quietly with lifetime focus: only the ones unlocked are shown, with when the
// next one comes, in hours.
const glows = computed(() => unlockedGlows(props.lifetimeFocusMs));
const glow = computed(() => glowFor(props.settings.glow, props.lifetimeFocusMs));
const hoursSoFar = computed(() => Math.floor(props.lifetimeFocusMs / 3_600_000).toLocaleString());
const glowHelp = computed(() => {
  const next = nextGlow(props.lifetimeFocusMs);
  const soFar = `${hoursSoFar.value} ${hoursSoFar.value === '1' ? 'hour' : 'hours'}`;
  return next
    ? `For the frames' corners and the tabs' dot. More colors come with lifetime focus: ${soFar} so far, and the next at ${next.hours.toLocaleString()} hours.`
    : `For the frames' corners and the tabs' dot. Every color is unlocked, with ${soFar} of focus.`;
});
</script>

<template>
  <section class="settings">
    <section class="read" aria-labelledby="sessions">
      <h2 id="sessions" class="mono">{{ numbered('sessions') }} — Sessions</h2>
      <div class="field">
        <div class="line">
          Emergency passes per week
          <NumberField
            label="Emergency passes per week"
            unit="passes"
            :min="0"
            :max="14"
            :model-value="settings.passesPerWeek"
            @update:model-value="save({ passesPerWeek: $event })"
          />
        </div>
        <span class="mono status"
          ><span class="dot pass" aria-hidden="true" />Left now <b>{{ String(passesLeft).padStart(2, '0') }}</b></span
        >
        <p class="help">
          For ending a Hard session before its timer is done. Each one comes back 7 days after it's used. During a Hard
          session this can only go down.
        </p>
      </div>
      <div class="field">
        <div class="line">
          End a session after
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
    </section>

    <section class="read" aria-labelledby="satellites">
      <h2 id="satellites" class="mono">{{ numbered('satellites') }} — Satellites</h2>
      <div class="field">
        <HotkeyField :hotkey="settings.satelliteHotkey" />
        <p class="help">
          Opens the satellite box from any app, to park a thought without leaving what you're doing. To change it, press
          Change and then the new keys together. It needs {{ mac ? 'Option' : 'Alt' }}, or two of
          {{ mac ? 'Control, Shift and Command' : 'Control, Shift and the Windows key' }}, so it doesn't take a shortcut
          other apps use. The menu bar can always open the box too.
        </p>
      </div>
    </section>

    <section class="read" aria-labelledby="browsers">
      <h2 id="browsers" class="mono">{{ numbered('browsers') }} — Browsers</h2>
      <ul v-if="browsers.length" class="browsers">
        <li v-for="browser in browsers" :key="browser.path">
          <span class="name" :title="browser.path">{{ browser.name }}</span>
          <span class="mono status"><span class="dot" aria-hidden="true" />Linked</span>
          <button
            class="key"
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
      <div class="field">
        <ToggleSwitch
          label="Close browsers without the extension"
          :model-value="settings.closeBrowsers"
          @update:model-value="save({ closeBrowsers: $event })"
        />
        <p class="help">
          In a Medium session, the browser closes a minute after the warning. In Hard, the session also counts as
          broken. During a Hard session this can't be turned off.
        </p>
      </div>
    </section>

    <section class="read" aria-labelledby="sky">
      <h2 id="sky" class="mono">{{ numbered('sky') }} — Sky</h2>
      <div class="field">
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
    </section>

    <section class="read" aria-labelledby="glow">
      <h2 id="glow" class="mono">{{ numbered('glow') }} — Glow color</h2>
      <div class="field">
        <div class="line">
          <span
            >{{ glow.name }}<span v-if="glow.hours === 0" class="faint mono"> · default</span
            ><span v-else class="faint mono"> · {{ glow.hours.toLocaleString() }} hours</span></span
          >
          <GlowPicker :glows="glows" :picked="glow.id" @pick="save({ glow: $event })" />
        </div>
        <p class="help">{{ glowHelp }}</p>
      </div>
    </section>

    <section v-if="development" class="read" aria-labelledby="sample">
      <h2 id="sample" class="mono">{{ numbered('sample') }} — Sample data <span class="faint">· dev builds</span></h2>
      <div class="field">
        <div class="line">
          Six weeks of made-up sessions
          <span class="buttons">
            <button class="key" type="button" @click="emit('sample-data', 'add')">Add</button>
            <button class="key" type="button" @click="emit('sample-data', 'remove')">Remove</button>
          </span>
        </div>
        <p class="help">
          For trying the sky and the weekly report. Sample sessions are marked, so Remove takes them all out and leaves
          your own.
        </p>
      </div>
    </section>

    <button class="card done mono" type="button" @click="emit('close')">Done · Back to the sky</button>
    <p class="colophon mono">Lock In · AGPL-3.0 · Stays on this computer</p>
  </section>
</template>

<style scoped>
/* Numbered sections with hairlines between them, like the weekly report. */
.read {
  padding: 14px 0 4px;
  border-bottom: 1px solid var(--line);
}

h2 {
  margin: 0 0 2px;
  font-weight: 400;
}

.faint {
  color: var(--faint);
}

.field {
  display: grid;
  gap: 6px;
  padding: 10px 0;
}

.field + .field {
  border-top: 1px dashed var(--line);
}

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
}

.help {
  margin: 0;
  color: var(--faint);
  font-size: 11.5px;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot.pass {
  --c: var(--glow);
}

.browsers {
  margin: 4px 0 8px;
  padding: 0;
  list-style: none;
}

.browsers li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
}

.name {
  flex: 1;
}

.key:disabled {
  opacity: 0.4;
  cursor: default;
}

.none {
  margin: 6px 0 8px;
  font-size: 12.5px;
}

.buttons {
  display: flex;
  gap: 6px;
}

.done {
  display: block;
  margin: 16px auto 0;
  padding: 6px 12px;
  background: none;
  color: var(--dim);
  transition: color 300ms;
}

.done:hover {
  color: var(--starlight);
}

.colophon {
  margin: 12px 0 4px;
  text-align: center;
}
</style>
