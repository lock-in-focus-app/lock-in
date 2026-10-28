import { starterProfiles, type GateVisit, type OwnQuote, type Profile, type Session } from '@lock-in/core';

/** The running session, shared by the popup and every content script. */
export const activeSession = storage.defineItem<Session | null>('local:activeSession', {
  fallback: null,
});

/** The user's profiles. Until they edit anything, these are the starter profiles. */
export const profiles = storage.defineItem<Profile[]>('local:profiles', {
  fallback: starterProfiles,
});

/** Trips to redirected sites, for the attempt counter and the "why?" answers. */
export const gateVisits = storage.defineItem<GateVisit[]>('local:gateVisits', {
  fallback: [],
});

/** Quotes the user added. They show up on the quote card alongside the bundled ones. */
export const ownQuotes = storage.defineItem<OwnQuote[]>('local:ownQuotes', {
  fallback: [],
});

/**
 * When the profiles and the session last changed, for the desktop app link. The newest
 * change wins, whether it was made here, in the app, or in another browser.
 */
export const syncedAt = storage.defineItem<{ profiles: number; activeSession: number }>('local:syncedAt', {
  fallback: { profiles: 0, activeSession: 0 },
});

/** Whether the tour for new users has been offered (taken or turned down), so the popup offers it once. */
export const tourOffered = storage.defineItem<boolean>('local:tourOffered', {
  fallback: false,
});

/** Whether the desktop app is linked right now. Kept in session storage, so it starts off false. */
export const desktopLinked = storage.defineItem<boolean>('session:desktopLinked', {
  fallback: false,
});
