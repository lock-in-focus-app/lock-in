import { isSafeSelector, normalizePath, pagePathAttribute } from '@lock-in/core';
import { describe, expect, it } from 'vitest';
import { recipes } from './index';

describe.each(recipes)('$name recipe', (recipe) => {
  it('has unique toggle ids', () => {
    const ids = recipe.toggles.map((toggle) => toggle.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses safe selectors', () => {
    const selectors = recipe.toggles.flatMap((toggle) => toggle.selectors ?? []);
    expect(selectors.filter((selector) => !isSafeSelector(selector))).toEqual([]);
  });

  it('only matches the page path on <html>, where the extension keeps it', () => {
    const selectors = recipe.toggles.flatMap((toggle) => toggle.selectors ?? []);
    const misplaced = selectors.filter(
      (selector) => selector.includes(pagePathAttribute) && !selector.startsWith('html'),
    );
    expect(misplaced).toEqual([]);
  });

  it('suggests pages with tidy, valid paths', () => {
    for (const page of recipe.pages ?? []) {
      expect(page.paths.length, page.label).toBeGreaterThan(0);
      for (const path of page.paths) expect(normalizePath(path), page.label).toBe(path);
    }
  });

  it('gives every toggle something to do', () => {
    for (const toggle of recipe.toggles) {
      expect(toggle.effect ?? toggle.selectors?.length, toggle.id).toBeTruthy();
    }
  });
});

it('has unique recipe ids', () => {
  const ids = recipes.map((recipe) => recipe.id);
  expect(new Set(ids).size).toBe(ids.length);
});
