import { expect, it } from 'vitest';
import { quotes } from './index';

it('has quotes', () => {
  expect(quotes.length).toBeGreaterThan(10);
});

it('has no duplicates', () => {
  const texts = quotes.map((quote) => quote.text);
  expect(new Set(texts).size).toBe(texts.length);
});

it('keeps quotes short enough to read at a glance', () => {
  expect(quotes.filter((quote) => quote.text.length > 140)).toEqual([]);
});

// The pack is public domain only, so each quote by someone notes where it comes from, to be
// checked. Lines with no author are Seiza's own.
it('notes where every quote by someone comes from', () => {
  expect(quotes.filter((quote) => quote.author && !quote.source?.trim())).toEqual([]);
});
