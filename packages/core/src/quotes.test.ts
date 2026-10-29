import { describe, expect, it } from 'vitest';
import { maxOwnQuotes, maxQuoteLength, quoteForDay, withOwnQuote, withOwnQuoteRemoved } from './quotes';

describe('withOwnQuote', () => {
  it('adds a trimmed quote, with an author only if there is one', () => {
    expect(withOwnQuote([], 'a', '  Ship it. ', '  ')).toEqual([{ id: 'a', text: 'Ship it.' }]);
    expect(withOwnQuote([], 'a', 'Ship it.', ' Me ')).toEqual([{ id: 'a', text: 'Ship it.', author: 'Me' }]);
  });

  it('skips empty quotes and keeps to the limits', () => {
    expect(withOwnQuote([], 'a', ' \n ', 'Me')).toEqual([]);
    expect(withOwnQuote([], 'a', 'x'.repeat(maxQuoteLength + 5), '')[0]!.text).toHaveLength(maxQuoteLength);
    const full = Array.from({ length: maxOwnQuotes }, (_, i) => ({ id: String(i), text: 'Line' }));
    expect(withOwnQuote(full, 'new', 'One more', '')).toHaveLength(maxOwnQuotes);
  });
});

it('removes a quote by id', () => {
  const list = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ];
  expect(withOwnQuoteRemoved(list, 'a')).toEqual([{ id: 'b', text: 'B' }]);
});

it('picks the same quote all day', () => {
  const bundled = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];
  const own = [{ id: 'm', text: 'Mine' }];
  expect(quoteForDay(bundled, own, '2026-10-28')).toBe(quoteForDay(bundled, own, '2026-10-28'));
  const days = Array.from({ length: 30 }, (_, i) => quoteForDay(bundled, own, `2026-11-${i + 1}`)?.text);
  expect(new Set(days).size).toBeGreaterThan(1);
  expect(quoteForDay([], [], '2026-10-28')).toBeUndefined();
});
