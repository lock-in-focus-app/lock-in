<script lang="ts" setup>
import {
  defaultWaits,
  parseHttpUrl,
  redirectDestinations,
  redirectSettingsFor,
  type GateSettings,
  type GateWait,
  type PassExpiry,
  type RedirectDestination,
  type RedirectSettings,
} from '@lock-in/core';
import { computed, ref, watch } from 'vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';
import NumberField from './components/NumberField.vue';

const profileList = useStorageItem(profiles);
const quoteList = useStorageItem(ownQuotes);

const selectedId = ref<string>();
watch(
  profileList,
  (list) => {
    if (list && !list.some((p) => p.id === selectedId.value)) selectedId.value = list[0]?.id;
  },
  { immediate: true },
);

const profile = computed(() => profileList.value?.find((p) => p.id === selectedId.value));
const settings = computed(() => redirectSettingsFor(profile.value));

const destinations: { id: RedirectDestination; label: string; detail: string }[] = [
  { id: 'gate', label: 'Intention gate', detail: 'Asks what you came for, then lets you through after a short wait.' },
  { id: 'quote', label: 'Quote', detail: 'A quote from the built-in pack or your own.' },
  { id: 'link', label: 'Your links', detail: 'One of the links below, like your draft or to-do list.' },
  { id: 'stuck', label: "I'm stuck", detail: 'A 2-minute unstick: name it, shrink it, stretch, breathe.' },
];

const expiryOptions: { id: PassExpiry; label: string }[] = [
  { id: 'pause', label: 'Pause the tab' },
  { id: 'redirect', label: 'Send it back to the gate' },
  { id: 'nothing', label: 'Leave it open' },
];

function save(patch: Partial<RedirectSettings>) {
  if (profile.value) void setRedirectSettings(profile.value.id, { ...settings.value, ...patch });
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

// Links
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

// Quotes
const quoteText = ref('');
const quoteAuthor = ref('');

async function addQuote() {
  await addOwnQuote(quoteText.value, quoteAuthor.value);
  quoteText.value = '';
  quoteAuthor.value = '';
}
</script>

<template>
  <main>
    <header>
      <p class="brand"><span class="star" aria-hidden="true">✦</span> Lock In</p>
      <h1>Settings</h1>
    </header>

    <section v-if="profileList && profile">
      <div class="profiles" role="tablist" aria-label="Profile">
        <button
          v-for="p in profileList"
          :key="p.id"
          type="button"
          role="tab"
          :aria-selected="p.id === selectedId"
          @click="selectedId = p.id"
        >
          {{ p.name }}
        </button>
      </div>

      <h2>Redirected sites</h2>
      <p class="help">When {{ profile.name }} redirects a site, show one of these at random.</p>
      <ul class="destinations">
        <li v-for="d in destinations" :key="d.id">
          <label>
            <input
              type="checkbox"
              :checked="settings.destinations.includes(d.id)"
              :disabled="settings.destinations.length === 1 && settings.destinations.includes(d.id)"
              @change="toggleDestination(d.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>
              <span class="name">{{ d.label }}</span>
              <span class="detail">{{ d.detail }}</span>
            </span>
          </label>
        </li>
      </ul>
      <p class="help small">Every page has a "Still need it?" link that goes to the intention gate.</p>

      <h2>Intention gate</h2>
      <div class="rows">
        <ToggleSwitch
          label="Require a reason to continue"
          :model-value="settings.gate.requireReason"
          @update:model-value="saveGate({ requireReason: $event })"
        />

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
      <p class="help small">This also applies to tabs that were already open when the session started.</p>

      <h2>Your links</h2>
      <p class="help">Shown when "Your links" is picked for {{ profile.name }}.</p>
      <ul v-if="settings.links.length" class="items">
        <li v-for="link in settings.links" :key="link.id">
          <span>
            <span class="name">{{ link.title }}</span>
            <span class="detail">{{ link.url }}</span>
          </span>
          <button type="button" class="remove" :aria-label="`Remove ${link.title}`" @click="removeLink(link.id)">Remove</button>
        </li>
      </ul>
      <form class="add" @submit.prevent="addLink">
        <input v-model="linkTitle" aria-label="Link name" placeholder="Name (optional)" />
        <input v-model="linkUrl" aria-label="Link address" placeholder="docs.google.com/…" />
        <button type="submit">Add link</button>
      </form>
      <p v-if="linkError" class="error" role="alert">{{ linkError }}</p>
    </section>

    <section>
      <h2>Your quotes</h2>
      <p class="help">Mixed in with the built-in quotes for every profile, and shown more often.</p>
      <ul v-if="quoteList?.length" class="items">
        <li v-for="quote in quoteList" :key="quote.id">
          <span>
            <span class="name">{{ quote.text }}</span>
            <span v-if="quote.author" class="detail">{{ quote.author }}</span>
          </span>
          <button type="button" class="remove" aria-label="Remove quote" @click="removeOwnQuote(quote.id)">Remove</button>
        </li>
      </ul>
      <form class="add" @submit.prevent="addQuote">
        <input v-model="quoteText" class="wide" aria-label="Quote" placeholder="A quote that gets you back to work" maxlength="280" />
        <input v-model="quoteAuthor" aria-label="Author" placeholder="Author (optional)" />
        <button type="submit" :disabled="!quoteText.trim()">Add quote</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
main {
  max-width: 560px;
  margin: 0 auto;
  padding: 40px 16px 80px;
}

.brand {
  margin: 0;
  color: var(--dim);
  font-size: 13px;
}

.star {
  color: var(--glow);
}

h1 {
  margin: 4px 0 24px;
  font-size: 28px;
  font-weight: 500;
}

h2 {
  margin: 32px 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.help {
  margin: 0 0 12px;
  color: var(--dim);
}

.help.small {
  margin-top: 8px;
  font-size: 12px;
}

.profiles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--sky-raised);
}

.profiles button {
  flex: 1;
  padding: 8px 12px;
  background: none;
  color: var(--dim);
  transition: background 150ms, color 150ms;
}

.profiles button[aria-selected='true'] {
  background: var(--sky-hover);
  color: var(--starlight);
}

ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

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

.name {
  display: block;
}

.detail {
  display: block;
  overflow: hidden;
  color: var(--dim);
  font-size: 12px;
  text-overflow: ellipsis;
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

select {
  padding: 6px 8px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky);
  color: var(--starlight);
  font: inherit;
}

.items li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--sky-raised);
}

.items li > span {
  min-width: 0;
}

.remove {
  flex: none;
  padding: 4px 8px;
  background: none;
  color: var(--dim);
  font-size: 12px;
}

.remove:hover {
  color: var(--starlight);
}

.add {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.add input {
  flex: 1 1 140px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky-raised);
  color: var(--starlight);
  font: inherit;
}

.add input.wide {
  flex-basis: 100%;
}

.add input:focus {
  border-color: var(--glow);
  outline: none;
}

.add button {
  padding: 8px 14px;
  background: var(--sky-hover);
}

.add button:disabled {
  color: var(--dim);
  cursor: default;
}

.error {
  margin: 6px 0 0;
  color: var(--glow);
  font-size: 12px;
}
</style>
