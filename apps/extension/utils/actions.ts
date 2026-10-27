import {
  endLock,
  findRule,
  redirectSettingsFor,
  starterProfiles,
  withNewProfile,
  withProfileDuplicated,
  withProfileMoved,
  withProfileRemoved,
  withProfilesRemoved,
  withProfileRenamed,
  withSiteLevel,
  withPathRuleRemoved,
  withPathRules,
  withStarterProfilesReset,
  withGateVisit,
  withGateVisitContinued,
  withGateVisitWhy,
  withPass,
  withProfileToggle,
  withRedirectSettings,
  withSatelliteAction,
  withSatelliteLaunched,
  withSatellitesBack,
  withSessionOverridesSaved,
  withSessionToggle,
  type Profile,
  type RedirectDestination,
  type RedirectSettings,
  type SatelliteAction,
  type SiteLevel,
  type SiteRecipe,
  type WhyReason,
} from '@lock-in/core';

// Every change to sessions and profiles goes through these actions. Today they save to
// extension storage; once the desktop app is connected, they'll forward to it instead,
// and the UI won't need to change.

// Edits read what's saved, change it and save it back. They run one at a time, so a quick
// second edit can't start from something the first hasn't saved yet and undo it.
let edits: Promise<unknown> = Promise.resolve();
function inTurn<T>(edit: () => Promise<T>): Promise<T> {
  const next = edits.then(edit);
  edits = next.catch(() => {});
  return next;
}

function editProfiles(edit: (list: Profile[]) => Profile[]): Promise<void> {
  return inTurn(async () => profiles.setValue(edit(await profiles.getValue())));
}

export async function startSession(profileId: string): Promise<void> {
  await inTurn(() => activeSession.setValue({ id: crypto.randomUUID(), profileId, startedAt: Date.now() }));
}

/**
 * Ends the session. The popup asks for a pause or typing first if its timer is still running.
 * A Hard session can't end here before its timer is done; the desktop app would only bring it back.
 */
export function endSession(): Promise<void> {
  return inTurn(async () => {
    if (endLock((await activeSession.getValue()) ?? { startedAt: 0 }, Date.now()) === 'hard') return;
    await activeSession.setValue(null);
  });
}

/** Changes a toggle for the running session only. */
export function setSessionToggle(recipe: SiteRecipe, toggleId: string, value: boolean): Promise<void> {
  return inTurn(async () => {
    const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
    if (!session) return;

    const rule = findRule(
      profileList.find((p) => p.id === session.profileId),
      recipe.id,
    );
    await activeSession.setValue(withSessionToggle(session, recipe, rule, toggleId, value));
  });
}

/** Changes a toggle on a profile, for every future session that uses it. */
export async function setProfileToggle(
  profileId: string,
  recipeId: string,
  toggleId: string,
  value: boolean,
): Promise<void> {
  await editProfiles((list) => withProfileToggle(list, profileId, recipeId, toggleId, value));
}

/** Keeps this session's changes to a site by saving them into the session's profile. */
export function saveSessionChanges(recipeId: string): Promise<void> {
  return inTurn(async () => {
    const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
    if (!session) return;

    const saved = withSessionOverridesSaved(profileList, session, recipeId);
    await storage.setItems([
      { item: profiles, value: saved.profiles },
      { item: activeSession, value: saved.session },
    ]);
  });
}

/** Adds an empty profile and returns its id. */
export async function createProfile(name = 'New profile'): Promise<string> {
  const id = crypto.randomUUID();
  await editProfiles((list) => withNewProfile(list, id, name));
  return id;
}

/** Copies a profile and returns the copy's id. */
export async function duplicateProfile(profileId: string): Promise<string> {
  const id = crypto.randomUUID();
  await editProfiles((list) => withProfileDuplicated(list, profileId, id));
  return id;
}

/** Deletes a profile, unless it's the one the running session uses. */
export async function deleteProfile(profileId: string): Promise<void> {
  if ((await activeSession.getValue())?.profileId === profileId) return;
  await editProfiles((list) => withProfileRemoved(list, profileId));
}

/** Deletes several profiles at once, skipping the one the running session uses. At least one is always kept. */
export async function deleteProfiles(profileIds: string[]): Promise<void> {
  const running = (await activeSession.getValue())?.profileId;
  const ids = profileIds.filter((id) => id !== running);
  await editProfiles((list) => withProfilesRemoved(list, ids));
}

export async function renameProfile(profileId: string, name: string): Promise<void> {
  await editProfiles((list) => withProfileRenamed(list, profileId, name));
}

/** Moves a profile earlier (-1) or later (1) in the list. */
export async function moveProfile(profileId: string, offset: number): Promise<void> {
  await editProfiles((list) => withProfileMoved(list, profileId, offset));
}

/** Sets whether a profile allows, tames, redirects or restricts a site. */
export async function setSiteLevel(profileId: string, recipeId: string, level: SiteLevel): Promise<void> {
  await editProfiles((list) => withSiteLevel(list, profileId, recipeId, level));
}

/** Adds page rules to a site, or changes the level of ones it has. Invalid paths are skipped. */
export async function setPageLevel(
  profileId: string,
  recipeId: string,
  paths: string[],
  level: SiteLevel,
): Promise<void> {
  await editProfiles((list) => withPathRules(list, profileId, recipeId, paths, level));
}

/** Removes a page rule, so the page follows its site's level again. */
export async function removePageRule(profileId: string, recipeId: string, path: string): Promise<void> {
  await editProfiles((list) => withPathRuleRemoved(list, profileId, recipeId, path));
}

/** Restores the starter profiles to how they shipped. The user's own profiles are kept. */
export async function resetStarterProfiles(): Promise<void> {
  await editProfiles((list) => withStarterProfilesReset(list, starterProfiles));
}

/** Changes how a profile handles redirected sites, starting from its saved settings. */
export async function setRedirectSettings(
  profileId: string,
  change: (current: RedirectSettings) => RedirectSettings,
): Promise<void> {
  await editProfiles((list) =>
    withRedirectSettings(list, profileId, change(redirectSettingsFor(list.find((p) => p.id === profileId)))),
  );
}

/** Records a trip to a redirected site and returns its id. */
export async function recordGateVisit(recipeId: string, destination: RedirectDestination | 'blocked'): Promise<string> {
  const visit = { id: crypto.randomUUID(), recipeId, at: Date.now(), destination };
  await inTurn(async () => gateVisits.setValue(withGateVisit(await gateVisits.getValue(), visit)));
  return visit.id;
}

/**
 * Gives the session a pass to a redirected site. Resolves once the browser has stopped
 * redirecting it, so the caller can navigate straight there.
 */
export async function continueToSite(visitId: string, recipeId: string, intention: string): Promise<void> {
  const continued = await inTurn(async () => {
    const [session, profileList, visits] = await Promise.all([
      activeSession.getValue(),
      profiles.getValue(),
      gateVisits.getValue(),
    ]);
    if (!session) return false;

    const { passMinutes } = redirectSettingsFor(profileList.find((p) => p.id === session.profileId)).gate;
    await storage.setItems([
      { item: activeSession, value: withPass(session, recipeId, Date.now(), passMinutes) },
      { item: gateVisits, value: withGateVisitContinued(visits, visitId, intention) },
    ]);
    return true;
  });
  if (continued) await syncRedirectsNow();
}

/** Saves the one-tap answer to "why are you here?" on a visit. */
export async function setVisitWhy(visitId: string, why: WhyReason | undefined): Promise<void> {
  await inTurn(async () => gateVisits.setValue(withGateVisitWhy(await gateVisits.getValue(), visitId, why)));
}

export async function addOwnQuote(text: string, author: string): Promise<void> {
  const quote = { id: crypto.randomUUID(), text: text.trim(), ...(author.trim() ? { author: author.trim() } : {}) };
  if (!quote.text) return;
  await inTurn(async () => ownQuotes.setValue([...(await ownQuotes.getValue()), quote]));
}

export async function removeOwnQuote(id: string): Promise<void> {
  await inTurn(async () => ownQuotes.setValue((await ownQuotes.getValue()).filter((quote) => quote.id !== id)));
}

/** Launches a thought into orbit. It comes back when the session ends, or the next one if none is running. */
export async function launchSatellite(text: string): Promise<void> {
  await inTurn(async () =>
    satellites.setValue(withSatelliteLaunched(await satellites.getValue(), crypto.randomUUID(), text, Date.now())),
  );
}

/** Ticks off, snoozes, keeps as a task or deletes a satellite. */
export async function actOnSatellite(id: string, action: SatelliteAction): Promise<void> {
  await inTurn(async () =>
    satellites.setValue(withSatelliteAction(await satellites.getValue(), id, action, Date.now())),
  );
}

/** Brings the satellites in orbit back, once a session has ended. */
export async function bringSatellitesBack(): Promise<void> {
  await inTurn(async () => satellites.setValue(withSatellitesBack(await satellites.getValue(), Date.now())));
}

/** Lets go of a satellite the desktop app has taken over. */
export async function forgetSatellite(id: string): Promise<void> {
  await inTurn(async () => satellites.setValue((await satellites.getValue()).filter((s) => s.id !== id)));
}
