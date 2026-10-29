import { describe, expect, it } from 'vitest';
import {
  defaultRedirectSettings,
  maxPlanLength,
  pageWaitFor,
  redirectSettingsFor,
  waitLabel,
  waitSecondsFor,
  waitSecondsLeft,
} from './settings';
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

  it('waits five minutes by default', () => {
    expect(defaultRedirectSettings.gate.wait).toEqual({ mode: 'fixed', seconds: 300 });
  });

  it('keeps the if-then plan trimmed and within its limit', () => {
    expect(redirectSettingsFor(profile({ plan: '  Write one paragraph first. ' })).plan).toBe(
      'Write one paragraph first.',
    );
    expect(redirectSettingsFor(profile({ plan: 'x'.repeat(maxPlanLength + 9) })).plan).toHaveLength(maxPlanLength);
    expect(redirectSettingsFor(profile({ plan: 42 as unknown as string })).plan).toBe('');
  });

  it('ignores the pages older profiles picked from', () => {
    const old = { destinations: ['quote'], gate: { requireReason: true } } as Profile['redirect'];
    expect(redirectSettingsFor(profile(old))).toEqual({
      ...defaultRedirectSettings,
      gate: { ...defaultRedirectSettings.gate, requireReason: true },
    });
  });

  it('clamps numbers into range', () => {
    const settings = redirectSettingsFor(profile({ gate: { passMinutes: 999, wait: { mode: 'fixed', seconds: -5 } } }));
    expect(settings.gate.passMinutes).toBe(120);
    expect(settings.gate.wait).toEqual({ mode: 'fixed', seconds: 0 });
    const long = redirectSettingsFor(profile({ gate: { wait: { mode: 'fixed', seconds: 5000 } } }));
    expect(long.gate.wait).toEqual({ mode: 'fixed', seconds: 600 });
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

describe('pageWaitFor', () => {
  const minute = 60_000;
  const running = { sessionId: 's', startedAt: 0, seconds: 300 };

  it('picks the running wait back up, and keeps the site a click away for as long again', () => {
    expect(pageWaitFor(running, 's', 60, 2 * minute)).toBe(running);
    expect(pageWaitFor(running, 's', 60, 9 * minute)).toBe(running);
  });

  it('starts a new wait once that has lapsed, in another session, or with none running', () => {
    expect(pageWaitFor(running, 's', 60, 10 * minute)).toEqual({ sessionId: 's', startedAt: 10 * minute, seconds: 60 });
    expect(pageWaitFor(running, 'other', 60, minute)).toEqual({ sessionId: 'other', startedAt: minute, seconds: 60 });
    expect(pageWaitFor(undefined, 's', 300, 5)).toEqual({ sessionId: 's', startedAt: 5, seconds: 300 });
  });
});

describe('waitSecondsLeft', () => {
  it('counts down in whole seconds, rounding up', () => {
    const wait = { sessionId: 's', startedAt: 0, seconds: 300 };
    expect(waitSecondsLeft(wait, 0)).toBe(300);
    expect(waitSecondsLeft(wait, 1)).toBe(300);
    expect(waitSecondsLeft(wait, 299_001)).toBe(1);
    expect(waitSecondsLeft(wait, 300_000)).toBe(0);
    expect(waitSecondsLeft(wait, 900_000)).toBe(0);
  });
});

describe('waitLabel', () => {
  it('says the wait in minutes when it is whole minutes, and in seconds otherwise', () => {
    expect(waitLabel(300)).toBe('5 minutes');
    expect(waitLabel(60)).toBe('1 minute');
    expect(waitLabel(90)).toBe('90 seconds');
    expect(waitLabel(10)).toBe('10 seconds');
    expect(waitLabel(1)).toBe('1 second');
  });
});
