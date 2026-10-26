import { describe, expect, it } from 'vitest';
import { defaultRedirectSettings, redirectSettingsFor, waitSecondsFor } from './settings';
import type { GateSettings, Profile } from './types';

const profile = (redirect: Profile['redirect']): Profile => ({ id: 'p', name: 'P', sites: [], redirect });

describe('redirectSettingsFor', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(redirectSettingsFor(undefined)).toEqual(defaultRedirectSettings);
    expect(redirectSettingsFor(profile(undefined))).toEqual(defaultRedirectSettings);
  });

  it('fills in missing gate fields', () => {
    const settings = redirectSettingsFor(profile({ gate: { requireReason: true } }));
    expect(settings.gate).toEqual({ ...defaultRedirectSettings.gate, requireReason: true });
  });

  it('keeps destinations in a fixed order without duplicates or unknown values', () => {
    const settings = redirectSettingsFor(profile({ destinations: ['stuck', 'gate', 'stuck', 'nope' as 'gate'] }));
    expect(settings.destinations).toEqual(['gate', 'stuck']);
  });

  it('falls back to the gate when no destination is left', () => {
    expect(redirectSettingsFor(profile({ destinations: [] })).destinations).toEqual(['gate']);
  });

  it('clamps numbers into range', () => {
    const settings = redirectSettingsFor(profile({ gate: { passMinutes: 999, wait: { mode: 'fixed', seconds: -5 } } }));
    expect(settings.gate.passMinutes).toBe(120);
    expect(settings.gate.wait).toEqual({ mode: 'fixed', seconds: 0 });
  });

  it('keeps the escalating cap at or above the starting wait', () => {
    const settings = redirectSettingsFor(
      profile({ gate: { wait: { mode: 'escalating', startSeconds: 30, stepSeconds: 5, maxSeconds: 10 } } }),
    );
    expect(settings.gate.wait).toEqual({ mode: 'escalating', startSeconds: 30, stepSeconds: 5, maxSeconds: 30 });
  });

  it('ignores an unknown pass expiry', () => {
    const settings = redirectSettingsFor(profile({ gate: { onPassExpiry: 'explode' as 'pause' } }));
    expect(settings.gate.onPassExpiry).toBe('pause');
  });

  it('drops links that are not http or https', () => {
    const links = [
      { id: 'a', title: 'Draft', url: 'https://docs.example.com/draft' },
      { id: 'b', title: 'Sneaky', url: 'javascript:alert(1)' },
      { id: 'c', title: 'Broken', url: 'not a url' },
    ];
    expect(redirectSettingsFor(profile({ links })).links.map((l) => l.id)).toEqual(['a']);
  });
});

describe('waitSecondsFor', () => {
  const gate = (wait: GateSettings['wait']): GateSettings => ({ ...defaultRedirectSettings.gate, wait });

  it('uses the same wait every time when fixed', () => {
    expect(waitSecondsFor(gate({ mode: 'fixed', seconds: 12 }), 1)).toBe(12);
    expect(waitSecondsFor(gate({ mode: 'fixed', seconds: 12 }), 9)).toBe(12);
  });

  it('grows with each attempt up to the cap when escalating', () => {
    const escalating = gate({ mode: 'escalating', startSeconds: 5, stepSeconds: 10, maxSeconds: 30 });
    expect([1, 2, 3, 4, 5].map((attempt) => waitSecondsFor(escalating, attempt))).toEqual([5, 15, 25, 30, 30]);
  });
});
