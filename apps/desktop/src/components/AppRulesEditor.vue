<script setup lang="ts">
import type { AppAction, AppRule, InstalledApp } from '@lock-in/core';
import { computed, ref } from 'vue';
import { installedApps } from '../app';

const props = defineProps<{ apps: AppRule[]; canHide: boolean }>();
const emit = defineEmits<{ 'update:apps': [apps: AppRule[]] }>();

const actionOptions: { id: AppAction; label: string }[] = [
  { id: 'close', label: 'Close' },
  { id: 'hide', label: 'Hide' },
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
      <li v-for="rule in apps" :key="rule.path" class="row">
        <span class="name" :title="rule.path">{{ rule.name }}</span>
        <select
          v-if="canHide"
          :aria-label="`What happens to ${rule.name}`"
          :value="rule.action"
          @change="setAction(rule.path, ($event.target as HTMLSelectElement).value as AppAction)"
        >
          <option v-for="option in actionOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
        <button class="small" type="button" :aria-label="`Remove ${rule.name}`" @click="remove(rule.path)">
          Remove
        </button>
      </li>
    </ul>
    <p v-else class="row-help">No apps yet.</p>

    <template v-if="picking">
      <input v-model="search" type="search" placeholder="Search apps" aria-label="Search apps" />
      <p v-if="!installed" class="row-help">Looking for apps…</p>
      <ul v-else class="choices">
        <li v-for="app in choices" :key="app.path">
          <button type="button" class="choice" :title="app.path" @click="add(app)">{{ app.name }}</button>
        </li>
        <li v-if="!choices.length" class="row-help">No apps match.</li>
      </ul>
      <button class="small cancel" type="button" @click="picking = false">Cancel</button>
    </template>
    <button v-else class="small add" type="button" @click="startPicking">Add an app</button>

    <p class="row-help">They close when a session with this profile starts, and again if they're opened during it.</p>
    <p v-if="canHide" class="row-help">Hide keeps an app running with its windows out of sight.</p>
  </div>
</template>

<style scoped>
.editor {
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--sky-raised);
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-help {
  margin: 4px 0 8px;
  color: var(--dim);
  font-size: 12px;
}

select,
input {
  padding: 6px 8px;
  border: 1px solid var(--sky-hover);
  border-radius: 8px;
  background: var(--sky);
  color: var(--starlight);
  font: inherit;
}

select:focus,
input:focus {
  border-color: var(--glow);
  outline: none;
}

input {
  width: 100%;
  margin: 8px 0 4px;
  box-sizing: border-box;
}

.choices {
  max-height: 200px;
  overflow-y: auto;
}

.choice {
  width: 100%;
  padding: 8px;
  text-align: left;
  background: none;
}

.choice:hover {
  background: var(--sky-hover);
}

.small {
  padding: 6px 10px;
  background: var(--sky);
  color: var(--dim);
  font-size: 12px;
}

.small:hover {
  background: var(--sky-hover);
}

.add,
.cancel {
  margin: 8px 0 0;
}
</style>
