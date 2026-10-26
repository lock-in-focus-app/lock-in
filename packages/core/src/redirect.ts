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

/** The sites the active session is redirecting right now. Sites with a pass are left out. */
export function redirectedRecipes(options: {
  session: Session | null;
  profiles: readonly Profile[];
  recipes: readonly SiteRecipe[];
  now: number;
}): SiteRecipe[] {
  const { session, profiles, recipes, now } = options;
  if (!session) return [];

  const profile = profiles.find((p) => p.id === session.profileId);
  return recipes.filter(
    (recipe) => findRule(profile, recipe.id)?.level === 'redirected' && !hasPass(session, recipe.id, now),
  );
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

/** What an already-open page on a redirected site should do right now. */
export type OpenPageCheck =
  | {
      action: 'none';
      /** When to check again, because a pass runs out then. */
      recheckAt?: number;
    }
  | {
      action: Exclude<PassExpiry, 'nothing'>;
      recipe: SiteRecipe;
      profile: Profile;
      /** True when the page had a pass that ran out, false when it was open before the session. */
      passExpired: boolean;
    };

/**
 * New visits to redirected sites never load: the browser redirects them. Pages that were
 * already open when the session started, or when a pass ran out, are handled here using
 * the profile's "when a pass runs out" setting.
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
  if (!session || !profile || !recipe || findRule(profile, recipe.id)?.level !== 'redirected') return { action: 'none' };

  if (hasPass(session, recipe.id, now)) return { action: 'none', recheckAt: session.passes![recipe.id] };

  const { onPassExpiry } = redirectSettingsFor(profile).gate;
  if (onPassExpiry === 'nothing') return { action: 'none' };
  return { action: onPassExpiry, recipe, profile, passExpired: session.passes?.[recipe.id] !== undefined };
}
