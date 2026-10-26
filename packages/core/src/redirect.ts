import { findRule } from './edits';
import { findRecipe } from './recipe';
import { redirectSettingsFor } from './settings';
import type { GateVisit, PassExpiry, Profile, Session, SiteRecipe, WhyReason } from './types';

/** Longest intention we keep. */
export const maxIntentionLength = 200;

/** How long gate visits are kept. */
const visitRetentionDays = 90;
const day = 24 * 60 * 60 * 1000;

export function hasPass(session: Session | null, recipeId: string, now: number): boolean {
  return (session?.passes?.[recipeId] ?? 0) > now;
}

/**
 * Whether a site is kept from loading right now. Redirected sites open up while they have
 * a pass; restricted sites stay shut until the session ends.
 */
export function siteAccess(options: {
  session: Session | null;
  profiles: readonly Profile[];
  recipeId: string;
  now: number;
}): 'open' | 'redirected' | 'restricted' {
  const { session, profiles, recipeId, now } = options;
  if (!session) return 'open';

  const level = findRule(
    profiles.find((p) => p.id === session.profileId),
    recipeId,
  )?.level;
  if (level === 'restricted') return 'restricted';
  if (level === 'redirected' && !hasPass(session, recipeId, now)) return 'redirected';
  return 'open';
}

/** The sites the active session keeps from loading right now: redirected ones without a pass, and restricted ones. */
export function redirectedRecipes(options: {
  session: Session | null;
  profiles: readonly Profile[];
  recipes: readonly SiteRecipe[];
  now: number;
}): SiteRecipe[] {
  const { recipes, ...rest } = options;
  return recipes.filter((recipe) => siteAccess({ ...rest, recipeId: recipe.id }) !== 'open');
}

/** Gives the session a pass to one site, dropping any passes that have already run out. */
export function withPass(session: Session, recipeId: string, now: number, minutes: number): Session {
  const live = Object.entries(session.passes ?? {}).filter(([, until]) => until > now);
  return { ...session, passes: { ...Object.fromEntries(live), [recipeId]: now + minutes * 60_000 } };
}

/** When the next pass runs out, if any are still running. */
export function nextPassExpiry(session: Session | null, now: number): number | undefined {
  const upcoming = Object.values(session?.passes ?? {}).filter((until) => until > now);
  return upcoming.length > 0 ? Math.min(...upcoming) : undefined;
}

/** How many times the gate has been hit for a site since local midnight. */
export function attemptsToday(visits: readonly GateVisit[], recipeId: string, now: number): number {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  return visits.filter((visit) => visit.recipeId === recipeId && visit.at >= midnight).length;
}

/** Adds a visit and forgets ones older than the retention window. */
export function withGateVisit(visits: readonly GateVisit[], visit: GateVisit): GateVisit[] {
  const cutoff = visit.at - visitRetentionDays * day;
  return [...visits.filter((v) => v.at >= cutoff), visit];
}

/** Marks a visit as continued, keeping what the user said they came for. */
export function withGateVisitContinued(visits: readonly GateVisit[], visitId: string, intention: string): GateVisit[] {
  const trimmed = intention.trim().slice(0, maxIntentionLength);
  return visits.map((visit) =>
    visit.id === visitId ? { ...visit, continued: true, ...(trimmed ? { intention: trimmed } : {}) } : visit,
  );
}

/** Records the one-tap answer to "why are you here?", or clears it. */
export function withGateVisitWhy(visits: readonly GateVisit[], visitId: string, why: WhyReason | undefined): GateVisit[] {
  return visits.map((visit) => {
    if (visit.id !== visitId) return visit;
    const { why: _previous, ...rest } = visit;
    return why ? { ...rest, why } : rest;
  });
}

/** What an already-open page on a redirected or restricted site should do right now. */
export type OpenPageCheck =
  | {
      action: 'none';
      /** When to check again, because a pass runs out then. */
      recheckAt?: number;
    }
  | {
      action: Exclude<PassExpiry, 'nothing'> | 'block';
      recipe: SiteRecipe;
      profile: Profile;
      /** True when the page had a pass that ran out, false when it was open before the session. */
      passExpired: boolean;
    };

/**
 * New visits to redirected and restricted sites never load: the browser redirects them.
 * Pages that were already open when the session started, or when a pass ran out, are
 * handled here. Restricted sites are always covered; redirected ones follow the profile's
 * "when a pass runs out" setting.
 */
export function checkOpenPage(options: {
  url: string | URL;
  session: Session | null;
  profiles: readonly Profile[];
  recipes: readonly SiteRecipe[];
  now: number;
}): OpenPageCheck {
  const { url, session, profiles, recipes, now } = options;
  const profile = profiles.find((p) => p.id === session?.profileId);
  const recipe = findRecipe(recipes, url);
  const level = findRule(profile, recipe?.id ?? '')?.level;
  if (!session || !profile || !recipe || (level !== 'redirected' && level !== 'restricted')) return { action: 'none' };

  if (level === 'restricted') return { action: 'block', recipe, profile, passExpired: false };
  if (hasPass(session, recipe.id, now)) return { action: 'none', recheckAt: session.passes![recipe.id] };

  const { onPassExpiry } = redirectSettingsFor(profile).gate;
  if (onPassExpiry === 'nothing') return { action: 'none' };
  return { action: onPassExpiry, recipe, profile, passExpired: session.passes?.[recipe.id] !== undefined };
}
