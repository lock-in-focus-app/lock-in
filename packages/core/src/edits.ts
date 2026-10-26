import type { Profile, RedirectSettings, Session, SiteRecipe, SiteRule } from './types';

// Pure, immutable edits to profiles and sessions. The extension (and later the desktop
// app) persists whatever these return.

export function findRule(profile: Profile | undefined, recipeId: string): SiteRule | undefined {
  return profile?.sites.find((site) => site.recipeId === recipeId);
}

/**
 * Sets a toggle for the current session only. Setting it back to the profile's value
 * removes the override, so the session only records real differences.
 */
export function withSessionToggle(
  session: Session,
  recipe: SiteRecipe,
  rule: SiteRule | undefined,
  toggleId: string,
  value: boolean,
): Session {
  const toggle = recipe.toggles.find((t) => t.id === toggleId);
  if (!toggle) return session;

  const baseline = rule?.toggles?.[toggleId] ?? toggle.default;
  const { [toggleId]: _previous, ...others } = session.overrides?.[recipe.id] ?? {};
  return withRecipeOverrides(session, recipe.id, value === baseline ? others : { ...others, [toggleId]: value });
}

/** Sets a toggle on a profile's rule for a site. Profiles without a rule for that site are left alone. */
export function withProfileToggle(
  profiles: readonly Profile[],
  profileId: string,
  recipeId: string,
  toggleId: string,
  value: boolean,
): Profile[] {
  return profiles.map((profile) =>
    profile.id !== profileId
      ? profile
      : {
          ...profile,
          sites: profile.sites.map((site) =>
            site.recipeId === recipeId ? { ...site, toggles: { ...site.toggles, [toggleId]: value } } : site,
          ),
        },
  );
}

/** Replaces how a profile handles redirected sites. */
export function withRedirectSettings(profiles: readonly Profile[], profileId: string, settings: RedirectSettings): Profile[] {
  return profiles.map((profile) => (profile.id === profileId ? { ...profile, redirect: settings } : profile));
}

/** Copies a session's overrides for one site into its profile, then clears them from the session. */
export function withSessionOverridesSaved(
  profiles: readonly Profile[],
  session: Session,
  recipeId: string,
): { profiles: Profile[]; session: Session } {
  const rule = findRule(
    profiles.find((p) => p.id === session.profileId),
    recipeId,
  );
  const overrides = session.overrides?.[recipeId];
  if (!rule || !overrides) return { profiles: [...profiles], session };

  const saved = Object.entries(overrides).reduce(
    (list, [toggleId, value]) => withProfileToggle(list, session.profileId, recipeId, toggleId, value),
    [...profiles],
  );
  return { profiles: saved, session: withRecipeOverrides(session, recipeId, {}) };
}

/** Replaces one site's session overrides, dropping empty maps so the session stays tidy. */
function withRecipeOverrides(session: Session, recipeId: string, recipeOverrides: Record<string, boolean>): Session {
  const { [recipeId]: _old, ...otherRecipes } = session.overrides ?? {};
  const overrides = Object.keys(recipeOverrides).length > 0 ? { ...otherRecipes, [recipeId]: recipeOverrides } : otherRecipes;

  const { overrides: _previous, ...rest } = session;
  return Object.keys(overrides).length > 0 ? { ...rest, overrides } : rest;
}
