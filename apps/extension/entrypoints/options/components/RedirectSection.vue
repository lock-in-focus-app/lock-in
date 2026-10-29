<script lang="ts" setup>
import {
  defaultWaits,
  maxPlanLength,
  waitLabel,
  parseHttpUrl,
  redirectSettingsFor,
  type GateSettings,
  type GateWait,
  type PassExpiry,
  type Profile,
  type RedirectSettings,
} from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';
import NumberField from './NumberField.vue';

const props = defineProps<{ profile: Profile }>();

const settings = computed(() => redirectSettingsFor(props.profile));

const expiryOptions: { id: PassExpiry; label: string }[] = [
  { id: 'pause', label: 'Pause the tab' },
  { id: 'redirect', label: 'Send it back to the redirect page' },
  { id: 'nothing', label: 'Leave it open' },
];

// Each change is worked out from the saved settings at the moment it's saved, not from what's
// on screen, so two quick changes in a row can't undo each other.
function save(change: (current: RedirectSettings) => Partial<RedirectSettings>) {
  void setRedirectSettings(props.profile.id, (current) => ({ ...current, ...change(current) }));
}

function saveGate(patch: Partial<GateSettings>) {
  save((current) => ({ gate: { ...current.gate, ...patch } }));
}

function saveWait(patch: Partial<GateWait>) {
  save((current) => ({ gate: { ...current.gate, wait: { ...current.gate.wait, ...patch } as GateWait } }));
}

// The plan is typed here and saved when the field is left, so each keystroke isn't a save.
const plan = ref(settings.value.plan);
watch(
  () => settings.value.plan,
  (saved) => (plan.value = saved),
);

function savePlan() {
  if (plan.value.trim() !== settings.value.plan) save(() => ({ plan: plan.value.trim() }));
}

const linkTitle = ref('');
const linkUrl = ref('');
const linkError = ref('');

function addLink() {
  const raw = linkUrl.value.trim();
  const url = parseHttpUrl(raw) ?? parseHttpUrl(`https://${raw}`);
  if (!raw || !url || !url.hostname.includes('.')) {
    linkError.value = 'Enter a web address, like docs.google.com/…';
    return;
  }
  const title = linkTitle.value.trim() || url.hostname;
  const link = { id: crypto.randomUUID(), title, url: url.href };
  save((current) => ({ links: [...current.links, link] }));
  linkTitle.value = '';
  linkUrl.value = '';
  linkError.value = '';
}

function removeLink(id: string) {
  save((current) => ({ links: current.links.filter((link) => link.id !== id) }));
}
</script>

<template>
  <h2>Redirected sites</h2>
  <p class="help">
    When {{ profile.name }} redirects a site, you land on a Lock In page first. It asks you to focus for a little while,
    and once the wait is up you can go on to the site with a short pass. The wait keeps counting if you leave the page
    to work. Restricted sites have no way through.
  </p>

  <h2>Your if-then plan</h2>
  <p class="help">
    Decide now what you'll do when the urge comes, and the redirect page shows it to you each time. Planning "when this
    happens, I'll do that" ahead of time is one of the best-tested ways to change a habit.
  </p>
  <label class="card plan" data-tour="redirect">
    <input
      v-model="plan"
      aria-label="Your if-then plan"
      placeholder="When I want Reddit, I'll write one paragraph first."
      :maxlength="maxPlanLength"
      @blur="savePlan"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />
  </label>

  <h2>The wait</h2>
  <div class="rows">
    <div class="row">
      <span>Wait before going on</span>
      <select
        aria-label="Wait before going on"
        :value="settings.gate.wait.mode"
        @change="saveGate({ wait: defaultWaits[($event.target as HTMLSelectElement).value as GateWait['mode']] })"
      >
        <option value="fixed">The same every time</option>
        <option value="escalating">Longer each try</option>
      </select>
    </div>
    <div v-if="settings.gate.wait.mode === 'fixed'" class="row sub">
      <span>Wait</span>
      <NumberField
        label="Wait in seconds"
        unit="sec"
        :min="0"
        :max="600"
        :model-value="settings.gate.wait.seconds"
        @update:model-value="saveWait({ seconds: $event })"
      />
    </div>
    <template v-else>
      <div class="row sub">
        <span>First try today</span>
        <NumberField
          label="First wait in seconds"
          unit="sec"
          :min="0"
          :max="600"
          :model-value="settings.gate.wait.startSeconds"
          @update:model-value="saveWait({ startSeconds: $event })"
        />
      </div>
      <div class="row sub">
        <span>Add for each try after</span>
        <NumberField
          label="Seconds added per try"
          unit="sec"
          :min="0"
          :max="600"
          :model-value="settings.gate.wait.stepSeconds"
          @update:model-value="saveWait({ stepSeconds: $event })"
        />
      </div>
      <div class="row sub">
        <span>Never longer than</span>
        <NumberField
          label="Longest wait in seconds"
          unit="sec"
          :min="0"
          :max="600"
          :model-value="settings.gate.wait.maxSeconds"
          @update:model-value="saveWait({ maxSeconds: $event })"
        />
      </div>
    </template>

    <p class="row-help">
      <template v-if="settings.gate.wait.mode === 'fixed' && settings.gate.wait.seconds === 0">
        No wait: the page just asks if you still want the site.
      </template>
      <template v-else-if="settings.gate.wait.mode === 'fixed'">
        The page says "Focus for {{ waitLabel(settings.gate.wait.seconds) }} first". A few seconds works too, for a
        short pause.
      </template>
      <template v-else>"Longer each try" starts short and grows with every visit to the same site today.</template>
    </p>

    <ToggleSwitch
      label="Require a reason to go on"
      :model-value="settings.gate.requireReason"
      @update:model-value="saveGate({ requireReason: $event })"
    />
    <p class="row-help">
      The page asks what you came for, and you can't go on until you answer. Answers stay on this device.
    </p>

    <div class="row">
      <span>Pass length</span>
      <NumberField
        label="Pass length in minutes"
        unit="min"
        :min="1"
        :max="120"
        :model-value="settings.gate.passMinutes"
        @update:model-value="saveGate({ passMinutes: $event })"
      />
    </div>
    <p class="row-help">How long the site stays open after you go on to it. Other redirected sites stay redirected.</p>

    <div class="row">
      <span>When a pass runs out</span>
      <select
        aria-label="When a pass runs out"
        :value="settings.gate.onPassExpiry"
        @change="saveGate({ onPassExpiry: ($event.target as HTMLSelectElement).value as PassExpiry })"
      >
        <option v-for="option in expiryOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
      </select>
    </div>
  </div>
  <p class="help small">
    Pausing covers the tab until you choose to keep going or close it. This also applies to tabs that were already open
    when the session started.
  </p>

  <h2>Your links</h2>
  <p class="help">
    Places you'd rather be: the draft you're meant to be writing, your to-do list, flashcards or reading list. They show
    up as buttons on the redirect page, to get you back to work.
  </p>
  <ul v-if="settings.links.length" class="list items">
    <li v-for="link in settings.links" :key="link.id">
      <span>
        <span class="name">{{ link.title }}</span>
        <span class="detail">{{ link.url }}</span>
      </span>
      <button type="button" class="text-button" :aria-label="`Remove ${link.title}`" @click="removeLink(link.id)">
        Remove
      </button>
    </li>
  </ul>
  <form class="add links" @submit.prevent="addLink">
    <input v-model="linkTitle" aria-label="Link name" placeholder="Name (optional)" />
    <input v-model="linkUrl" aria-label="Link address" placeholder="docs.google.com/…" />
    <button type="submit">Add link</button>
  </form>
  <p v-if="linkError" class="error" role="alert">{{ linkError }}</p>
</template>

<style scoped>
/* The plan field, framed with corner ticks like the other boxes. */
.plan {
  display: block;
  padding: 0;
}

.plan input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: var(--starlight);
  font: inherit;
}

.plan input:focus {
  outline: none;
}

.plan:focus-within {
  --t: var(--tick-bright);
}

.rows {
  padding: 4px 12px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--sky-raised);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.row.sub {
  padding-left: 16px;
  color: var(--dim);
}

.row-help {
  margin: -4px 0 8px;
  color: var(--dim);
  font-size: 12px;
}
</style>
