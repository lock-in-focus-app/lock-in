import type { Profile, RedirectSettings, Session, SiteLevel, SiteRecipe, SiteRule } from './types';

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

/** Longest profile name we keep. */
export const maxProfileNameLength = 40;

/** Adds an empty profile at the end. Every site starts out allowed. */
export function withNewProfile(profiles: readonly Profile[], id: string, name: string): Profile[] {
  return [...profiles, { id, name: cleanName(name) || 'New profile', sites: [] }];
}

/** Copies a profile, placing the copy right after it. */
export function withProfileDuplicated(profiles: readonly Profile[], profileId: string, newId: string): Profile[] {
  const index = profiles.findIndex((p) => p.id === profileId);
  const original = profiles[index];
  if (!original) return [...profiles];

  const copy: Profile = structuredClone({ ...original, id: newId, name: cleanName(`${original.name} copy`) });
  return [...profiles.slice(0, index + 1), copy, ...profiles.slice(index + 1)];
}

export function withProfileRemoved(profiles: readonly Profile[], profileId: string): Profile[] {
  return profiles.filter((p) => p.id !== profileId);
}

/** Renames a profile. Blank names are ignored. */
export function withProfileRenamed(profiles: readonly Profile[], profileId: string, name: string): Profile[] {
  const cleaned = cleanName(name);
  if (!cleaned) return [...profiles];
  return profiles.map((p) => (p.id === profileId ? { ...p, name: cleaned } : p));
}

/** Moves a profile earlier (negative offset) or later in the list, stopping at either end. */
export function withProfileMoved(profiles: readonly Profile[], profileId: string, offset: number): Profile[] {
  const from = profiles.findIndex((p) => p.id === profileId);
  if (from === -1) return [...profiles];

  const to = Math.min(profiles.length - 1, Math.max(0, from + offset));
  const list = [...profiles];
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved!);
  return list;
}

/** Sets how a profile treats a site. Toggles are kept, so switching back to tamed restores them. */
export function withSiteLevel(profiles: readonly Profile[], profileId: string, recipeId: string, level: SiteLevel): Profile[] {
  return profiles.map((profile) => {
    if (profile.id !== profileId) return profile;
    const exists = profile.sites.some((site) => site.recipeId === recipeId);
    return {
      ...profile,
      sites: exists
        ? profile.sites.map((site) => (site.recipeId === recipeId ? { ...site, level } : site))
        : [...profile.sites, { recipeId, level }],
    };
  });
}

/** Puts the starter profiles back the way they shipped, keeping the user's own profiles. */
export function withStarterProfilesReset(profiles: readonly Profile[], starters: readonly Profile[]): Profile[] {
  const restored = profiles.map((profile) => starters.find((s) => s.id === profile.id) ?? profile);
  const missing = starters.filter((starter) => !profiles.some((p) => p.id === starter.id));
  return structuredClone([...restored, ...missing]);
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, maxProfileNameLength);
}
