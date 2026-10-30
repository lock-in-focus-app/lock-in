// "Tame <site> all the time": a site tamed even with no session running, belonging to no profile
// (`allTheTime` in its site settings). What the switch does, in the words the popup and the
// settings page both show under it.

export function allTheTimeNote(siteName: string, on: boolean): string {
  return on
    ? `${siteName} stays tamed like this with no session running. In a session, its profile's settings apply instead.`
    : `Off, ${siteName} is left as it is when no session is running.`;
}
