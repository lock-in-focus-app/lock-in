import type {
  Activity,
  AppRule,
  InstalledApp,
  SatelliteAction,
  Settings,
  Snapshot,
  TimerSettings,
} from '@lock-in/core';
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

export const setProfileApps = (profileId: string, apps: AppRule[]) =>
  invoke<void>('set_profile_apps', { profileId, apps });

/** The apps that can be added to a profile. */
export const installedApps = () => invoke<InstalledApp[]>('installed_apps');

export const setSettings = (settings: Settings) => invoke<void>('set_settings', { settings });

export const forgetBrowser = (path: string) => invoke<void>('forget_browser', { path });

/** Launches a thought into orbit. Resolves to whether there was anything to launch. */
export const launchSatellite = (text: string) => invoke<boolean>('launch_satellite', { text });

export const actOnSatellite = (id: string, action: SatelliteAction) => invoke<void>('act_on_satellite', { id, action });

/** Everything logged from `from` up to (not including) `to` (epoch ms), for the weekly report. */
export const activity = (from: number, to: number) => invoke<Activity>('activity', { from, to });

type WeekInfo = { firstDay: number };

/**
 * The first day of the week as set on this computer, 0 being Sunday: from the system where the
 * core can read it (macOS), otherwise the default for the window's language, otherwise Monday.
 */
export async function firstDayOfWeek(): Promise<number> {
  const system = await invoke<number | null>('first_weekday');
  if (system !== null) return system;
  // Newer engines have getWeekInfo(); older ones had a weekInfo property instead.
  const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
    getWeekInfo?: () => WeekInfo;
    weekInfo?: WeekInfo;
  };
  const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
  // Counted from 1, for Monday, to 7, for Sunday.
  return firstDay ? firstDay % 7 : 1;
}

/** Closes the satellite box and hands focus back to the app you were in. */
export const closeCapture = () => invoke<void>('close_capture');

export { maxSatelliteLength } from '@lock-in/core';
