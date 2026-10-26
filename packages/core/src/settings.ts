import { parseHttpUrl } from './match';
import type { GateSettings, GateWait, Profile, RedirectDestination, RedirectSettings } from './types';

export const redirectDestinations: readonly RedirectDestination[] = ['gate', 'quote', 'link', 'stuck'];

export const defaultRedirectSettings: RedirectSettings = {
  destinations: ['gate'],
  gate: {
    requireReason: false,
    wait: { mode: 'fixed', seconds: 10 },
    passMinutes: 5,
    onPassExpiry: 'pause',
  },
  links: [],
};

/** Defaults for each wait mode, used when switching between them. */
export const defaultWaits = {
  fixed: { mode: 'fixed', seconds: 10 },
  escalating: { mode: 'escalating', startSeconds: 5, stepSeconds: 5, maxSeconds: 60 },
} as const satisfies Record<GateWait['mode'], GateWait>;

const limits = {
  waitSeconds: [0, 300],
  passMinutes: [1, 120],
} as const;

/**
 * A profile's redirect settings with defaults filled in. Values are clamped and cleaned,
 * since they come from storage and may have been edited or imported.
 */
export function redirectSettingsFor(profile: Profile | undefined): RedirectSettings {
  const saved = profile?.redirect;
  const destinations = redirectDestinations.filter((d) => (saved?.destinations ?? defaultRedirectSettings.destinations).includes(d));
  return {
    destinations: destinations.length > 0 ? destinations : ['gate'],
    gate: resolveGate(saved?.gate),
    links: (saved?.links ?? []).filter((link) => parseHttpUrl(link.url)),
  };
}

/** How long Continue stays disabled for this attempt at a site (1 = the first today). */
export function waitSecondsFor(gate: GateSettings, attempt: number): number {
  const { wait } = gate;
  if (wait.mode === 'fixed') return wait.seconds;
  return Math.min(wait.maxSeconds, wait.startSeconds + wait.stepSeconds * Math.max(0, attempt - 1));
}

function resolveGate(saved: Partial<GateSettings> | undefined): GateSettings {
  const defaults = defaultRedirectSettings.gate;
  const onPassExpiry = saved?.onPassExpiry;
  return {
    requireReason: saved?.requireReason ?? defaults.requireReason,
    wait: resolveWait(saved?.wait),
    passMinutes: clamp(saved?.passMinutes, limits.passMinutes, defaults.passMinutes),
    onPassExpiry: onPassExpiry === 'nothing' || onPassExpiry === 'redirect' ? onPassExpiry : 'pause',
  };
}

function resolveWait(saved: GateWait | undefined): GateWait {
  const seconds = (value: number | undefined, fallback: number) => clamp(value, limits.waitSeconds, fallback);
  if (saved?.mode === 'escalating') {
    const defaults = defaultWaits.escalating;
    const startSeconds = seconds(saved.startSeconds, defaults.startSeconds);
    return {
      mode: 'escalating',
      startSeconds,
      stepSeconds: seconds(saved.stepSeconds, defaults.stepSeconds),
      maxSeconds: Math.max(startSeconds, seconds(saved.maxSeconds, defaults.maxSeconds)),
    };
  }
  return { mode: 'fixed', seconds: seconds(saved?.seconds, defaultWaits.fixed.seconds) };
}

function clamp(value: number | undefined, [min, max]: readonly [number, number], fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}
