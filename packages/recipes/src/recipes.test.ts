import { isSafeSelector } from '@lock-in/core';
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
