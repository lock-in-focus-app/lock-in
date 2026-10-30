import { describe, expect, it } from 'vitest';
import { allTheTimeToggles } from './recipe';
import {
  maxHiddenParts,
  siteSettingsFor,
  withAllTheTime,
  withAllTheTimeToggle,
  withHiddenPart,
  withHiddenPartRemoved,
} from './siteSettings';
import type { SiteRecipe, SiteSettings } from './types';

const recipe: SiteRecipe = {
  id: 'example',
  name: 'Example',
  matches: ['*://*.example.com/*'],
  toggles: [
    { id: 'hideFeed', label: 'Hide feed', selectors: ['#feed'], default: true },
    { id: 'grayscale', label: 'Grayscale', effect: 'grayscale', default: false },
  ],
};
const part = { selector: 'aside.trending', label: 'Trending now' };
const hidden = (list: SiteSettings[]) => siteSettingsFor(list, 'example')?.hidden;

describe('hidden parts', () => {
  it('hides a picked part once, tidied, adding the site', () => {
    const edited = withHiddenPart([], 'example', { selector: ' aside.trending ', label: ' Trending now ' });
    expect(edited).toEqual([{ recipeId: 'example', hidden: [part] }]);
    expect(hidden(withHiddenPart(edited, 'example', part))).toEqual([part]);
  });

  it('skips selectors that could break out of the stylesheet, and parts past the limit', () => {
    expect(withHiddenPart([], 'example', { selector: 'a } body {', label: 'x' })).toEqual([]);
    const full = Array.from({ length: maxHiddenParts }, (_, i) => ({ selector: `#p${i}`, label: '' }));
    const filled = full.reduce((list: SiteSettings[], p) => withHiddenPart(list, 'example', p), []);
    expect(hidden(withHiddenPart(filled, 'example', part))).toHaveLength(maxHiddenParts);
  });

  it('shows one again, and drops a site left with nothing', () => {
    const edited = withHiddenPart([], 'example', part);
    expect(withHiddenPartRemoved(edited, 'example', part.selector)).toEqual([]);
    const kept = withAllTheTime(edited, 'example', true);
    expect(withHiddenPartRemoved(kept, 'example', part.selector)).toEqual([{ recipeId: 'example', allTheTime: true }]);
  });
});

describe('tamed all the time', () => {
  it('turns on and off, keeping its toggles', () => {
    const on = withAllTheTimeToggle(withAllTheTime([], 'example', true), 'example', 'grayscale', true);
    expect(allTheTimeToggles(recipe, siteSettingsFor(on, 'example'))).toEqual({ hideFeed: true, grayscale: true });
    const off = withAllTheTime(on, 'example', false);
    expect(off).toEqual([{ recipeId: 'example', toggles: { grayscale: true } }]);
    expect(allTheTimeToggles(recipe, undefined)).toEqual({ hideFeed: true, grayscale: false });
  });
});
