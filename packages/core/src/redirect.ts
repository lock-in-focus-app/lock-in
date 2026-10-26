import { findRule } from './edits';
import type { GateVisit, Profile, Session, SiteRecipe } from './types';

/** How the intention gate behaves. These become per-profile settings later. */
export const gateDefaults = {
  /** How long the Continue button stays disabled. */
  waitSeconds: 10,
  /** How long a pass to a redirected site lasts. */
  passMinutes: 5,
  /** Longest intention we keep. */
  maxIntentionLength: 200,
} as const;

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
export function withPass(session: Session, recipeId: string, now: number, minutes: number = gateDefaults.passMinutes): Session {
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
  const trimmed = intention.trim().slice(0, gateDefaults.maxIntentionLength);
  return visits.map((visit) =>
    visit.id === visitId ? { ...visit, continued: true, ...(trimmed ? { intention: trimmed } : {}) } : visit,
  );
}
