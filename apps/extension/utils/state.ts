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
