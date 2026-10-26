import { describe, expect, it } from 'vitest';
import { withProfileToggle, withSessionOverridesSaved, withSessionToggle } from './edits';
import type { Profile, Session, SiteRecipe } from './types';

const recipe: SiteRecipe = {
  id: 'example',
  name: 'Example',
  matches: ['*://*.example.com/*'],
  toggles: [
    { id: 'hideFeed', label: 'Hide feed', selectors: ['#feed'], default: true },
    { id: 'grayscale', label: 'Grayscale', effect: 'grayscale', default: false },
  ],
};

const profiles: Profile[] = [
  { id: 'focus', name: 'Focus', sites: [{ recipeId: 'example', level: 'tamed', toggles: { grayscale: true } }] },
  { id: 'other', name: 'Other', sites: [{ recipeId: 'example', level: 'tamed' }] },
];

const rule = profiles[0]!.sites[0]!;
const session: Session = { id: 's1', profileId: 'focus', startedAt: 0 };

describe('withSessionToggle', () => {
  it('records a change for this session only', () => {
    const next = withSessionToggle(session, recipe, rule, 'hideFeed', false);
    expect(next.overrides).toEqual({ example: { hideFeed: false } });
    expect(session.overrides).toBeUndefined();
  });

  it('drops the override when set back to the profile value', () => {
    const changed = withSessionToggle(session, recipe, rule, 'grayscale', false);
    expect(changed.overrides).toEqual({ example: { grayscale: false } });
    expect(withSessionToggle(changed, recipe, rule, 'grayscale', true)).toEqual(session);
  });

  it('keeps overrides for other toggles and sites', () => {
    const start: Session = { ...session, overrides: { other: { x: true }, example: { grayscale: false } } };
    expect(withSessionToggle(start, recipe, rule, 'hideFeed', false).overrides).toEqual({
      other: { x: true },
      example: { grayscale: false, hideFeed: false },
    });
  });

  it('uses the recipe default when the profile has no rule', () => {
    expect(withSessionToggle(session, recipe, undefined, 'hideFeed', true)).toEqual(session);
  });

  it('ignores unknown toggles', () => {
    expect(withSessionToggle(session, recipe, rule, 'nope', true)).toBe(session);
  });
});

describe('withProfileToggle', () => {
  it('changes only the matching profile and site', () => {
    const next = withProfileToggle(profiles, 'other', 'example', 'grayscale', true);
    expect(next[1]!.sites[0]!.toggles).toEqual({ grayscale: true });
    expect(next[0]).toBe(profiles[0]);
    expect(profiles[1]!.sites[0]!.toggles).toBeUndefined();
  });

  it('leaves profiles without a rule for the site unchanged', () => {
    expect(withProfileToggle(profiles, 'focus', 'missing', 'hideFeed', false)).toEqual(profiles);
  });
});

describe('withSessionOverridesSaved', () => {
  it('moves session overrides into the profile', () => {
    const changed: Session = { ...session, overrides: { example: { hideFeed: false }, other: { x: true } } };
    const result = withSessionOverridesSaved(profiles, changed, 'example');
    expect(result.profiles[0]!.sites[0]!.toggles).toEqual({ grayscale: true, hideFeed: false });
    expect(result.session.overrides).toEqual({ other: { x: true } });
  });

  it('removes the overrides field once nothing is left', () => {
    const changed: Session = { ...session, overrides: { example: { hideFeed: false } } };
    expect(withSessionOverridesSaved(profiles, changed, 'example').session).toEqual(session);
  });

  it('does nothing when the profile has no rule for the site', () => {
    const changed: Session = { ...session, overrides: { missing: { x: true } } };
    const result = withSessionOverridesSaved(profiles, changed, 'missing');
    expect(result.profiles).toEqual(profiles);
    expect(result.session).toBe(changed);
  });
});
