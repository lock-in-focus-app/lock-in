import type { Profile } from '@lock-in/core';

// "Tame <site> all the time": a tamed site stays tamed with no session running, the way one
// profile tames it (`outsideSessions` on its site rule). What the switch does, in the words the
// popup and the settings page both show under it.

export function allTheTimeNote(siteName: string, profile: Profile, by: Profile | undefined): string {
  if (by?.id === profile.id) {
    return `${siteName} looks like this even with no session running. Another profile's session uses its own settings.`;
  }
  if (by) return `${by.name} keeps ${siteName} tamed all the time now. Turning this on moves it to ${profile.name}.`;
  return `Off, ${siteName} is only tamed during ${profile.name} sessions.`;
}
