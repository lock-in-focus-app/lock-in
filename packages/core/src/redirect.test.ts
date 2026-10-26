import { describe, expect, it } from 'vitest';
import {
  attemptsToday,
  checkOpenPage,
  hasPass,
  nextPassExpiry,
  redirectedRecipes,
  withGateVisit,
  withGateVisitContinued,
  withGateVisitWhy,
  withPass,
} from './redirect';
import type { GateVisit, Profile, Session, SiteRecipe } from './types';

const site = (id: string): SiteRecipe => ({ id, name: id, matches: [`*://*.${id}.com/*`], toggles: [] });
const recipes = [site('reddit'), site('x'), site('docs')];

const profiles: Profile[] = [
  {
    id: 'deep',
    name: 'Deep',
    sites: [
      { recipeId: 'reddit', level: 'redirected' },
      { recipeId: 'x', level: 'redirected' },
      { recipeId: 'docs', level: 'allowed' },
    ],
  },
];

const now = 1_000_000;
const minute = 60_000;
const session: Session = { id: 's1', profileId: 'deep', startedAt: 0 };

describe('redirectedRecipes', () => {
  const ids = (list: SiteRecipe[]) => list.map((r) => r.id);

  it("returns the profile's redirected sites", () => {
    expect(ids(redirectedRecipes({ session, profiles, recipes, now }))).toEqual(['reddit', 'x']);
  });

  it('redirects nothing without a session or profile', () => {
    expect(redirectedRecipes({ session: null, profiles, recipes, now })).toEqual([]);
    expect(redirectedRecipes({ session, profiles: [], recipes, now })).toEqual([]);
  });

  it('leaves out sites with a running pass', () => {
    const passed = { ...session, passes: { reddit: now + minute } };
    expect(ids(redirectedRecipes({ session: passed, profiles, recipes, now }))).toEqual(['x']);
    expect(ids(redirectedRecipes({ session: passed, profiles, recipes, now: now + minute }))).toEqual(['reddit', 'x']);
  });
});

describe('passes', () => {
  it('lasts the given number of minutes', () => {
    const passed = withPass(session, 'reddit', now, 5);
    expect(passed.passes).toEqual({ reddit: now + 5 * minute });
    expect(hasPass(passed, 'reddit', now + 5 * minute - 1)).toBe(true);
    expect(hasPass(passed, 'reddit', now + 5 * minute)).toBe(false);
    expect(hasPass(passed, 'x', now)).toBe(false);
    expect(hasPass(null, 'reddit', now)).toBe(false);
  });

  it('drops expired passes when adding one', () => {
    const old = { ...session, passes: { x: now - 1, reddit: now + minute } };
    expect(withPass(old, 'docs', now, 5).passes).toEqual({ reddit: now + minute, docs: now + 5 * minute });
  });

  it('reports the next expiry', () => {
    const passed = { ...session, passes: { x: now - 1, reddit: now + 2 * minute, docs: now + minute } };
    expect(nextPassExpiry(passed, now)).toBe(now + minute);
    expect(nextPassExpiry(session, now)).toBeUndefined();
    expect(nextPassExpiry(null, now)).toBeUndefined();
  });
});

describe('gate visits', () => {
  const today = new Date(2026, 9, 26, 15).getTime();
  const visit = (id: string, recipeId: string, at: number): GateVisit => ({ id, recipeId, at });

  it('counts attempts at a site since midnight', () => {
    const visits = [
      visit('a', 'reddit', new Date(2026, 9, 25, 23).getTime()),
      visit('b', 'reddit', new Date(2026, 9, 26, 0, 5).getTime()),
      visit('c', 'x', new Date(2026, 9, 26, 9).getTime()),
      visit('d', 'reddit', new Date(2026, 9, 26, 14).getTime()),
    ];
    expect(attemptsToday(visits, 'reddit', today)).toBe(2);
    expect(attemptsToday(visits, 'docs', today)).toBe(0);
  });

  it('forgets visits after 90 days', () => {
    const old = visit('old', 'reddit', today - 91 * 24 * 60 * minute);
    const recent = visit('recent', 'reddit', today - 89 * 24 * 60 * minute);
    expect(withGateVisit([old, recent], visit('new', 'x', today)).map((v) => v.id)).toEqual(['recent', 'new']);
  });

  it('records the intention when continuing', () => {
    const visits = [visit('a', 'reddit', today), visit('b', 'x', today)];
    expect(withGateVisitContinued(visits, 'a', '  find the thread about tents  ')).toEqual([
      { ...visits[0], continued: true, intention: 'find the thread about tents' },
      visits[1],
    ]);
  });

  it('leaves out empty intentions and trims long ones', () => {
    expect(withGateVisitContinued([visit('a', 'reddit', today)], 'a', '   ')[0]).not.toHaveProperty('intention');
    expect(withGateVisitContinued([visit('a', 'reddit', today)], 'a', 'x'.repeat(500))[0]!.intention).toHaveLength(200);
  });
});

describe('withGateVisitWhy', () => {
  const visits: GateVisit[] = [{ id: 'a', recipeId: 'reddit', at: now }];

  it('records, changes and clears the answer', () => {
    const bored = withGateVisitWhy(visits, 'a', 'bored');
    expect(bored[0]!.why).toBe('bored');
    expect(withGateVisitWhy(bored, 'a', 'stuck')[0]!.why).toBe('stuck');
    expect(withGateVisitWhy(bored, 'a', undefined)[0]).toEqual(visits[0]);
  });
});

describe('checkOpenPage', () => {
  const url = 'https://www.reddit.com/r/all';
  const withExpiry = (onPassExpiry: 'nothing' | 'pause' | 'redirect'): Profile[] => [
    { ...profiles[0]!, redirect: { gate: { onPassExpiry } } },
  ];

  it('pauses pages that were open before the session by default', () => {
    expect(checkOpenPage({ url, session, profiles, recipes, now })).toMatchObject({
      action: 'pause',
      recipe: { id: 'reddit' },
      passExpired: false,
    });
  });

  it('notes when a pass ran out', () => {
    const expired = { ...session, passes: { reddit: now - 1 } };
    expect(checkOpenPage({ url, session: expired, profiles, recipes, now })).toMatchObject({ passExpired: true });
  });

  it('follows the profile setting', () => {
    expect(checkOpenPage({ url, session, profiles: withExpiry('redirect'), recipes, now }).action).toBe('redirect');
    expect(checkOpenPage({ url, session, profiles: withExpiry('nothing'), recipes, now })).toEqual({ action: 'none' });
  });

  it('waits until a running pass ends', () => {
    const passed = { ...session, passes: { reddit: now + minute } };
    expect(checkOpenPage({ url, session: passed, profiles, recipes, now })).toEqual({ action: 'none', recheckAt: now + minute });
  });

  it('leaves other pages alone', () => {
    expect(checkOpenPage({ url, session: null, profiles, recipes, now })).toEqual({ action: 'none' });
    expect(checkOpenPage({ url: 'https://docs.com/', session, profiles, recipes, now })).toEqual({ action: 'none' });
    expect(checkOpenPage({ url: 'https://example.org/', session, profiles, recipes, now })).toEqual({ action: 'none' });
  });
});
