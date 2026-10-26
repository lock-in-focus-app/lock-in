<script lang="ts" setup>
import { maxProfileNameLength } from '@lock-in/core';
import { computed, nextTick, ref, watch } from 'vue';
import QuotesSection from './components/QuotesSection.vue';
import RedirectSection from './components/RedirectSection.vue';
import SitesSection from './components/SitesSection.vue';

const profileList = useStorageItem(profiles);
const session = useStorageItem(activeSession);

const selectedId = ref<string>();
watch(
  profileList,
  (list) => {
    if (list && !list.some((p) => p.id === selectedId.value)) selectedId.value = list[0]?.id;
  },
  { immediate: true },
);

const profile = computed(() => profileList.value?.find((p) => p.id === selectedId.value));
const position = computed(() => profileList.value?.findIndex((p) => p.id === selectedId.value) ?? -1);
const isRunning = computed(() => !!profile.value && session.value?.profileId === profile.value.id);
const canDelete = computed(() => !isRunning.value && (profileList.value?.length ?? 0) > 1);

const nameInput = ref<HTMLInputElement>();
const confirmingDelete = ref(false);
const confirmingReset = ref(false);
watch(selectedId, () => (confirmingDelete.value = false));

async function select(id: string, focusName = false) {
  selectedId.value = id;
  if (!focusName) return;
  await nextTick();
  nameInput.value?.select();
}

async function rename(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!profile.value) return;
  await renameProfile(profile.value.id, input.value);
  // A blank name is ignored, so put the saved one back in the field.
  input.value = profile.value.name;
}

async function remove() {
  if (!profile.value) return;
  await deleteProfile(profile.value.id);
  confirmingDelete.value = false;
}

async function reset() {
  await resetStarterProfiles();
  confirmingReset.value = false;
}

// Manage mode: tick several profiles and delete them in one go.
const managing = ref(false);
const picked = ref<string[]>([]);
const confirmingBulk = ref(false);
const deletable = computed(() => (profileList.value ?? []).filter((p) => p.id !== session.value?.profileId));
// At least one profile always stays.
const keepsOne = computed(() => picked.value.length < (profileList.value?.length ?? 0));

function startManaging() {
  managing.value = true;
  picked.value = [];
  confirmingBulk.value = false;
}

async function deletePicked() {
  await deleteProfiles(picked.value);
  picked.value = [];
  confirmingBulk.value = false;
}
</script>

<template>
  <main>
    <header>
      <p class="brand"><span class="star" aria-hidden="true">✦</span> Lock In</p>
      <h1>Settings</h1>
      <p class="help intro">
        A profile is a set of rules for a focus session: which sites stay as they are, which are tamed, and which are
        redirected or restricted. Pick a profile to edit it. Changes save as you go, and apply straight away if the
        profile is running.
      </p>
    </header>

    <section v-if="profileList && profile">
      <div v-if="!managing" class="profiles">
        <div class="tabs" role="tablist" aria-label="Profiles">
          <button
            v-for="p in profileList"
            :key="p.id"
            type="button"
            role="tab"
            :aria-selected="p.id === selectedId"
            @click="select(p.id)"
          >
            {{ p.name }}
            <span v-if="session?.profileId === p.id" class="running" title="Running now" aria-label="(running now)" />
          </button>
        </div>
        <button type="button" class="new" @click="createProfile().then((id) => select(id, true))">+ New profile</button>
        <button v-if="!managing" type="button" class="text-button" @click="startManaging">Manage</button>
      </div>

      <div v-if="managing" class="manage">
        <h2>Manage profiles</h2>
        <p class="help">
          Tick the profiles you don't use any more to delete them together. The running profile can't be deleted, and at
          least one profile always stays.
        </p>
        <ul class="list items">
          <li v-for="p in profileList" :key="p.id">
            <label class="pick">
              <input
                v-model="picked"
                type="checkbox"
                :value="p.id"
                :disabled="!deletable.includes(p)"
                :aria-label="`Select ${p.name}`"
              />
              <span>
                <span class="name">{{ p.name }}</span>
                <span class="detail">{{ deletable.includes(p) ? profileSummary(p) : 'Running now' }}</span>
              </span>
            </label>
          </li>
        </ul>
        <div v-if="!confirmingBulk" class="actions">
          <button type="button" class="text-button" @click="picked = deletable.map((p) => p.id)">Select all</button>
          <button type="button" class="text-button" :disabled="!picked.length" @click="picked = []">Clear</button>
          <button
            type="button"
            class="text-button danger"
            :disabled="!picked.length || !keepsOne"
            :title="keepsOne ? undefined : 'At least one profile has to stay'"
            @click="confirmingBulk = true"
          >
            Delete {{ picked.length || '' }}
          </button>
          <button type="button" class="text-button done" @click="managing = false">Done</button>
        </div>
        <div v-else class="actions confirm" role="alert">
          <span>Delete {{ picked.length }} profile{{ picked.length === 1 ? '' : 's' }}? This can't be undone.</span>
          <button type="button" class="text-button" @click="confirmingBulk = false">Cancel</button>
          <button type="button" class="text-button danger confirm-delete" @click="deletePicked">Delete</button>
        </div>
        <p v-if="!keepsOne" class="help small">At least one profile has to stay. Untick one to delete the rest.</p>
      </div>

      <div v-if="!managing" class="profile">
        <label class="name-field">
          <span>Name</span>
          <input
            ref="nameInput"
            :key="profile.id"
            class="field"
            :value="profile.name"
            :maxlength="maxProfileNameLength"
            aria-label="Profile name"
            @change="rename"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
        </label>

        <div v-if="!confirmingDelete" class="actions">
          <button type="button" class="text-button" :disabled="position <= 0" @click="moveProfile(profile.id, -1)">
            Move earlier
          </button>
          <button
            type="button"
            class="text-button"
            :disabled="position >= profileList.length - 1"
            @click="moveProfile(profile.id, 1)"
          >
            Move later
          </button>
          <button
            type="button"
            class="text-button"
            @click="duplicateProfile(profile.id).then((id) => select(id, true))"
          >
            Duplicate
          </button>
          <button
            type="button"
            class="text-button danger"
            :disabled="!canDelete"
            :title="isRunning ? 'End the session to delete this profile' : undefined"
            @click="confirmingDelete = true"
          >
            Delete
          </button>
        </div>
        <div v-else class="actions confirm" role="alert">
          <span>Delete {{ profile.name }}?</span>
          <button type="button" class="text-button" @click="confirmingDelete = false">Cancel</button>
          <button type="button" class="text-button danger confirm-delete" @click="remove">Delete</button>
        </div>
      </div>

      <template v-if="!managing">
        <p v-if="isRunning" class="help small">{{ profile.name }} is running now, so changes apply right away.</p>

        <SitesSection :profile="profile" />
        <RedirectSection :profile="profile" />
      </template>
    </section>

    <section>
      <QuotesSection />
    </section>

    <footer>
      <template v-if="!confirmingReset">
        <button type="button" class="text-button reset" @click="confirmingReset = true">Reset starter profiles</button>
        <p class="help small">
          Puts Writing, Deep Work and Wind Down back the way they shipped. Your own profiles are kept.
        </p>
      </template>
      <div v-else class="actions confirm" role="alert">
        <span>Reset the starter profiles? Changes you made to them will be lost.</span>
        <button type="button" class="text-button" @click="confirmingReset = false">Cancel</button>
        <button type="button" class="text-button danger confirm-reset" @click="reset">Reset</button>
      </div>
    </footer>
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
  margin: 4px 0 8px;
  font-size: 28px;
  font-weight: 500;
}

.intro {
  margin-bottom: 24px;
}

.manage {
  margin-top: 8px;
}

.pick {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.pick input {
  margin-top: 3px;
  accent-color: var(--glow);
}

.manage .actions {
  margin-top: 8px;
}

.done {
  margin-left: auto;
  color: var(--glow);
}

.profiles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tabs {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--sky-raised);
}

.tabs button {
  flex: 1;
  padding: 8px 12px;
  background: none;
  color: var(--dim);
  white-space: nowrap;
  transition:
    background 150ms,
    color 150ms;
}

.tabs button[aria-selected='true'] {
  background: var(--sky-hover);
  color: var(--starlight);
}

.running {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 4px;
  border-radius: 50%;
  background: var(--glow);
  vertical-align: middle;
}

.new {
  padding: 8px 12px;
  background: none;
  color: var(--glow);
}

.new:hover {
  background: var(--sky-raised);
}

.profile {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 16px;
}

.name-field {
  display: flex;
  flex: 1 1 220px;
  align-items: center;
  gap: 10px;
  color: var(--dim);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.confirm span {
  margin-right: 6px;
  color: var(--starlight);
}

footer {
  margin-top: 48px;
  padding-top: 16px;
  border-top: 1px solid var(--sky-raised);
}

.reset {
  margin-left: -8px;
}

footer .help.small {
  margin-top: 4px;
}
</style>
