<script lang="ts" setup>
import {
  defaultWaits,
  parseHttpUrl,
  redirectDestinations,
  redirectSettingsFor,
  type GateSettings,
  type GateWait,
  type PassExpiry,
  type Profile,
  type RedirectDestination,
  type RedirectSettings,
} from '@lock-in/core';
import { computed, ref } from 'vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';
import NumberField from './NumberField.vue';

const props = defineProps<{ profile: Profile }>();

const settings = computed(() => redirectSettingsFor(props.profile));

// The pages a redirected visit can land on. The intention gate is set up in its own
// section: it's the way through, which every one of these links to.
const pages: { id: Exclude<RedirectDestination, 'gate'>; label: string; detail: string }[] = [
  { id: 'quote', label: 'Quote', detail: 'A quote to pull you back, from the built-in pack or your own.' },
  {
    id: 'link',
    label: 'Your links',
    detail: 'Opens one of your own links instead, like the draft you meant to write. Add them under Your links.',
  },
  {
    id: 'stuck',
    label: "I'm stuck",
    detail: 'For when you reached for the site because the work got hard: a 2-minute unstick.',
  },
];

const expiryOptions: { id: PassExpiry; label: string }[] = [
  { id: 'pause', label: 'Pause the tab' },
  { id: 'redirect', label: 'Send it back to the gate' },
  { id: 'nothing', label: 'Leave it open' },
];

function save(patch: Partial<RedirectSettings>) {
  void setRedirectSettings(props.profile.id, { ...settings.value, ...patch });
}

function saveGate(patch: Partial<GateSettings>) {
  save({ gate: { ...settings.value.gate, ...patch } });
}

function saveWait(patch: Partial<GateWait>) {
  saveGate({ wait: { ...settings.value.gate.wait, ...patch } as GateWait });
}

function toggleDestination(id: RedirectDestination, on: boolean) {
  const current = settings.value.destinations;
  save({ destinations: redirectDestinations.filter((d) => (d === id ? on : current.includes(d))) });
}

// A redirected visit has to land somewhere: on one of the pages, or straight on the gate.
const gateRightAway = computed(() => settings.value.destinations.includes('gate'));
const pagesPicked = computed(() => settings.value.destinations.filter((d) => d !== 'gate'));
const isLastChoice = (id: RedirectDestination) =>
  settings.value.destinations.length === 1 && settings.value.destinations.includes(id);
const linksMissing = computed(() => settings.value.destinations.includes('link') && settings.value.links.length === 0);

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
  save({ links: [...settings.value.links, { id: crypto.randomUUID(), title, url: url.href }] });
  linkTitle.value = '';
  linkUrl.value = '';
  linkError.value = '';
}

function removeLink(id: string) {
  save({ links: settings.value.links.filter((link) => link.id !== id) });
}
</script>

<template>
  <h2>Redirected sites</h2>
  <p class="help">
    When {{ profile.name }} redirects a site, you land on a Lock In page instead. Pick which pages can show up; one is
    chosen at random each visit. Every page has a "Still need it?" link to the intention gate below.
  </p>
  <ul class="list destinations">
    <li v-for="d in pages" :key="d.id">
      <label>
        <input
          type="checkbox"
          :checked="settings.destinations.includes(d.id)"
          :disabled="isLastChoice(d.id)"
          @change="toggleDestination(d.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>
          <span class="name">{{ d.label }}</span>
          <span class="detail">{{ d.detail }}</span>
        </span>
      </label>
    </li>
  </ul>
  <p v-if="linksMissing" class="help small">You haven't added any links yet, so Your links is skipped for now.</p>
  <p v-else-if="!pagesPicked.length" class="help small">
    None picked, so every redirected visit goes straight to the intention gate.
  </p>

  <h2>Intention gate</h2>
  <p class="help">
    The way through a redirected site. It asks what you came for and holds Continue for a few seconds, so opening the
    site becomes a choice instead of a habit. Continuing gives you a short pass to that one site. Restricted sites have
    no gate.
  </p>
  <div class="rows">
    <ToggleSwitch
      label="Show the gate right away"
      :model-value="gateRightAway"
      :disabled="isLastChoice('gate')"
      @update:model-value="toggleDestination('gate', $event)"
    />
    <p class="row-help">
      <template v-if="isLastChoice('gate')">Pick a page above to turn this off.</template>
      <template v-else>
        On: some visits land straight on the gate, mixed in with the pages above. Off: you always see a page first.
      </template>
    </p>

    <ToggleSwitch
      label="Require a reason to continue"
      :model-value="settings.gate.requireReason"
      @update:model-value="saveGate({ requireReason: $event })"
    />
    <p class="row-help">Continue stays off until you type what you came for. Answers stay on this device.</p>

    <div class="row">
      <span>Wait before Continue</span>
      <select
        aria-label="Wait before Continue"
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
        :max="300"
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
          :max="300"
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
          :max="300"
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
          :max="300"
          :model-value="settings.gate.wait.maxSeconds"
          @update:model-value="saveWait({ maxSeconds: $event })"
        />
      </div>
    </template>

    <p class="row-help">"Longer each try" starts short and grows with every visit to the same site today.</p>

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
    <p class="row-help">How long the site stays open after you continue. Other redirected sites stay redirected.</p>

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
    Places you'd rather be: the draft you're meant to be writing, your to-do list, flashcards or reading list. When Your
    links is picked above, a redirected visit can open one of these instead of the site.
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
.destinations label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--sky-raised);
  cursor: pointer;
}

.destinations input {
  margin-top: 3px;
  accent-color: var(--glow);
}

.rows {
  padding: 4px 12px;
  border-radius: 10px;
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
