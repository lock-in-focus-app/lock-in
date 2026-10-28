import { describe, expect, it } from 'vitest';
import { glowColors, glowFor, nextGlow, unlockedGlows } from './glow';

const HOUR = 3_600_000;

describe('glow colors', () => {
  it('starts with Starlight alone', () => {
    expect(unlockedGlows(0).map((glow) => glow.id)).toEqual(['starlight']);
    expect(nextGlow(0)?.id).toBe('aurora');
  });

  it('unlocks each one at its lifetime hours, not a minute before', () => {
    expect(unlockedGlows(100 * HOUR - 60_000).map((glow) => glow.id)).toEqual(['starlight']);
    expect(unlockedGlows(100 * HOUR).map((glow) => glow.id)).toEqual(['starlight', 'aurora']);
    expect(nextGlow(100 * HOUR)?.id).toBe('nebula');
  });

  it('has none left to come once they are all unlocked', () => {
    expect(unlockedGlows(10_000 * HOUR)).toEqual(glowColors);
    expect(nextGlow(10_000 * HOUR)).toBeUndefined();
  });

  it("shows Starlight for a glow that isn't unlocked or isn't known", () => {
    expect(glowFor('aurora', 120 * HOUR).id).toBe('aurora');
    expect(glowFor('nebula', 120 * HOUR).id).toBe('starlight');
    expect(glowFor('plaid', 10_000 * HOUR).id).toBe('starlight');
  });

  it('comes in the order of its hours, with unique ids and hex colors', () => {
    const hours = glowColors.map((glow) => glow.hours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    expect(new Set(glowColors.map((glow) => glow.id)).size).toBe(glowColors.length);
    for (const glow of glowColors) expect(glow.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
