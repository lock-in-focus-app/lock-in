import type { Settings, Snapshot, TimerSettings } from '@lock-in/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { onUnmounted, ref } from 'vue';

// The window is a view onto the app's Rust core, which owns the session. Changes go to the
// core as commands, and it sends a fresh snapshot back whenever anything changes, whether
// from here or from the menu bar.

/** The app's state, kept up to date as it changes. */
export function useSnapshot() {
  const snapshot = ref<Snapshot>();
  const stopListening = listen<Snapshot>('snapshot', (event) => (snapshot.value = event.payload));
  // A change that lands while this is loading is newer, so it wins.
  void invoke<Snapshot>('snapshot').then((value) => (snapshot.value ??= value));
  onUnmounted(() => void stopListening.then((stop) => stop()));
  return snapshot;
}

/** The current time, ticking once a second while the component is shown. */
export function useNow() {
  const now = ref(Date.now());
  const tick = setInterval(() => (now.value = Date.now()), 1000);
  onUnmounted(() => clearInterval(tick));
  return now;
}

export const startSession = (profileId: string) => invoke<void>('start_session', { profileId });

export const endSession = () => invoke<void>('end_session');

// Not `use…`, which would read as a Vue composable.
export const spendEmergencyPass = () => invoke<void>('use_emergency_pass');

export const setProfileTimer = (profileId: string, timer: TimerSettings) =>
  invoke<void>('set_profile_timer', { profileId, timer });

export const setSettings = (settings: Settings) => invoke<void>('set_settings', { settings });

export const forgetBrowser = (path: string) => invoke<void>('forget_browser', { path });
