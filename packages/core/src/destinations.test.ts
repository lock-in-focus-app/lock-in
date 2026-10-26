import { describe, expect, it } from 'vitest';
import { pickDestination, pickLink, pickQuote } from './destinations';
import { defaultRedirectSettings } from './settings';
import type { RedirectSettings } from './types';

// A "random" source that returns each value in turn.
const sequence =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0;

describe('pickDestination', () => {
  const settings = (patch: Partial<RedirectSettings>): RedirectSettings => ({ ...defaultRedirectSettings, ...patch });
  const link = { id: 'l', title: 'Draft', url: 'https://example.com' };

  it('picks among the enabled destinations', () => {
    const all = settings({ destinations: ['gate', 'quote', 'link', 'stuck'], links: [link] });
    expect(pickDestination(all, sequence(0))).toBe('gate');
    expect(pickDestination(all, sequence(0.3))).toBe('quote');
    expect(pickDestination(all, sequence(0.6))).toBe('link');
    expect(pickDestination(all, sequence(0.99))).toBe('stuck');
  });

  it('skips "your links" when there are none', () => {
    expect(pickDestination(settings({ destinations: ['link', 'quote'] }), sequence(0))).toBe('quote');
    expect(pickDestination(settings({ destinations: ['link'] }), sequence(0))).toBe('gate');
  });
});

describe('pickQuote', () => {
  const bundled = [{ text: 'A' }, { text: 'B' }];
  const own = [{ id: 'o', text: 'Mine' }];

  it("weights the user's own quotes three times", () => {
    // Two bundled quotes plus three copies of the user's one.
    expect(pickQuote(bundled, own, sequence(0))?.text).toBe('A');
    expect(pickQuote(bundled, own, sequence(0.39))?.text).toBe('B');
    expect(pickQuote(bundled, own, sequence(0.4))?.text).toBe('Mine');
    expect(pickQuote(bundled, own, sequence(0.99))?.text).toBe('Mine');
  });

  it('returns nothing when there are no quotes', () => {
    expect(pickQuote([], [])).toBeUndefined();
  });
});

it('picks a link', () => {
  expect(pickLink([], sequence(0))).toBeUndefined();
  expect(pickLink([{ id: 'a', title: 'A', url: 'https://a.example' }], sequence(0.5))?.id).toBe('a');
});
