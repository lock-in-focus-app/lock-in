import {
  findRule,
  withProfileToggle,
  withSessionOverridesSaved,
  withSessionToggle,
  type SiteRecipe,
} from '@lock-in/core';

// Every change to sessions and profiles goes through these actions. Today they save to
// extension storage; once the desktop app is connected, they'll forward to it instead,
// and the UI won't need to change.

export async function startSession(profileId: string): Promise<void> {
  await activeSession.setValue({ id: crypto.randomUUID(), profileId, startedAt: Date.now() });
}

export async function endSession(): Promise<void> {
  await activeSession.setValue(null);
}

/** Changes a toggle for the running session only. */
export async function setSessionToggle(recipe: SiteRecipe, toggleId: string, value: boolean): Promise<void> {
  const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
  if (!session) return;

  const rule = findRule(
    profileList.find((p) => p.id === session.profileId),
    recipe.id,
  );
  await activeSession.setValue(withSessionToggle(session, recipe, rule, toggleId, value));
}

/** Changes a toggle on a profile, for every future session that uses it. */
export async function setProfileToggle(
  profileId: string,
  recipeId: string,
  toggleId: string,
  value: boolean,
): Promise<void> {
  const profileList = await profiles.getValue();
  await profiles.setValue(withProfileToggle(profileList, profileId, recipeId, toggleId, value));
}

/** Keeps this session's changes to a site by saving them into the session's profile. */
export async function saveSessionChanges(recipeId: string): Promise<void> {
  const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
  if (!session) return;

  const saved = withSessionOverridesSaved(profileList, session, recipeId);
  await storage.setItems([
    { item: profiles, value: saved.profiles },
    { item: activeSession, value: saved.session },
  ]);
}
