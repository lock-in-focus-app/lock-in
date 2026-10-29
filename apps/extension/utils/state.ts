import {
  starterProfiles,
  type GateVisit,
  type OwnQuote,
  type PageWait,
  type Profile,
  type Session,
} from '@lock-in/core';

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

/**
 * The redirect page's running wait for each site, keyed by recipe id, so leaving the page to
 * work and coming back picks the countdown back up.
 */
export const pageWaits = storage.defineItem<Record<string, PageWait>>('local:pageWaits', {
  fallback: {},
});

/**
 * The user's own quotes, for the app's Sky. The extension doesn't show them any more, but keeps
 * them in step with the app, so quotes added here before reach the app when it links.
 */
export const ownQuotes = storage.defineItem<OwnQuote[]>('local:ownQuotes', {
  fallback: [],
});

/**
 * When the profiles, the session and the quotes last changed, for the desktop app link. The
 * newest change wins, whether it was made here, in the app, or in another browser. Quotes were
 * added later, so older installs have no time for them yet.
 */
export const syncedAt = storage.defineItem<{ profiles: number; activeSession: number; ownQuotes?: number }>(
  'local:syncedAt',
  { fallback: { profiles: 0, activeSession: 0 } },
);

/** Whether the tour for new users has been offered (taken or turned down), so the popup offers it once. */
export const tourOffered = storage.defineItem<boolean>('local:tourOffered', {
  fallback: false,
});

/** Whether the desktop app is linked right now. Kept in session storage, so it starts off false. */
export const desktopLinked = storage.defineItem<boolean>('session:desktopLinked', {
  fallback: false,
});
