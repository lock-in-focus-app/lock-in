<script setup lang="ts">
import type { AppAction, AppRule, InstalledApp } from '@lock-in/core';
import { computed, ref } from 'vue';
import { installedApps } from '../app';
import SegmentedControl from './SegmentedControl.vue';

const props = defineProps<{ apps: AppRule[]; canHide: boolean }>();
const emit = defineEmits<{ 'update:apps': [apps: AppRule[]] }>();

const actionOptions: { id: AppAction; label: string; title: string }[] = [
  { id: 'close', label: 'Close', title: 'Quit the app' },
  { id: 'hide', label: 'Hide', title: 'Keep it running with its windows out of sight' },
];

// The installed apps are read once, when the list is first opened.
const picking = ref(false);
const installed = ref<InstalledApp[]>();
const search = ref('');

async function startPicking() {
  picking.value = true;
  installed.value ??= await installedApps();
}

const choices = computed(() => {
  const query = search.value.trim().toLowerCase();
  return (installed.value ?? []).filter(
    (app) => !props.apps.some((rule) => rule.path === app.path) && app.name.toLowerCase().includes(query),
  );
});

function add(app: InstalledApp) {
  emit('update:apps', [...props.apps, { name: app.name, path: app.path, action: 'close' }]);
  picking.value = false;
  search.value = '';
}

const remove = (path: string) =>
  emit(
    'update:apps',
    props.apps.filter((rule) => rule.path !== path),
  );

const setAction = (path: string, action: AppAction) =>
  emit(
    'update:apps',
    props.apps.map((rule) => (rule.path === path ? { ...rule, action } : rule)),
  );
</script>

<template>
  <div class="editor">
    <ul v-if="apps.length" class="rules">
      <li v-for="rule in apps" :key="rule.path">
        <span class="name" :title="rule.path">{{ rule.name }}</span>
        <SegmentedControl
          v-if="canHide"
          class="action"
          :label="`What happens to ${rule.name}`"
          :options="actionOptions"
          :model-value="rule.action"
          @update:model-value="setAction(rule.path, $event)"
        />
        <button
          class="key"
          type="button"
          :title="`Remove ${rule.name}`"
          :aria-label="`Remove ${rule.name}`"
          @click="remove(rule.path)"
        >
          ×
        </button>
      </li>
    </ul>
    <p v-else class="help">No apps yet.</p>

    <template v-if="picking">
      <input v-model="search" class="card" type="search" placeholder="Search apps" aria-label="Search apps" />
      <p v-if="!installed" class="help">Looking for apps…</p>
      <ul v-else class="choices">
        <li v-for="app in choices" :key="app.path">
          <button type="button" class="choice" :title="app.path" @click="add(app)">{{ app.name }}</button>
        </li>
        <li v-if="!choices.length" class="help">No apps match.</li>
      </ul>
      <button class="card add mono" type="button" @click="picking = false">Cancel</button>
    </template>
    <button v-else class="card add mono" type="button" @click="startPicking">+ Add an app</button>

    <p class="help">
      They close when a session with this profile starts, and again if they're opened during it.
      <template v-if="canHide">Hide keeps an app running with its windows out of sight.</template>
    </p>
  </div>
</template>

<style scoped>
.editor {
  padding: 6px 0 10px;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rules li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action {
  width: 110px;
}

.help {
  margin: 8px 0 0;
  color: var(--faint);
  font-size: 11.5px;
}

input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 7px 9px;
  border: 0;
  outline: 0;
  background: none;
  color: var(--starlight);
  font: 12px var(--mono);
}

input:focus {
  --t: var(--tick-bright);
}

.choices {
  max-height: 200px;
  margin-top: 4px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.choice {
  width: 100%;
  padding: 7px 8px;
  border-radius: 3px;
  background: none;
  font-size: 12.5px;
  text-align: left;
}

.choice:hover {
  background: rgb(220 228 255 / 0.06);
}

.add {
  margin-top: 10px;
  padding: 6px 10px;
  background: none;
  color: var(--dim);
  transition: color 300ms;
}

.add:hover {
  color: var(--starlight);
}
</style>
