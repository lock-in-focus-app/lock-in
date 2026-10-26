import { matchPatternToRegex, nextPassExpiry, redirectedRecipes } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';

// Redirects are declarativeNetRequest rules: the browser matches them itself, so no
// extension code runs on each request. The background keeps the rules in step with the
// session, and anything that needs them current right away asks it to sync.

const syncMessage = 'lock-in:sync-redirects';
export const passAlarm = 'lock-in:pass-expiry';

/** Rebuilds the redirect rules for the current session and schedules the next pass expiry. */
export async function syncRedirects(): Promise<void> {
  const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
  const now = Date.now();
  const gate = browser.runtime.getURL('/gate.html');

  const regexes = redirectedRecipes({ session, profiles: profileList, recipes, now })
    .flatMap((recipe) => recipe.matches)
    .flatMap((pattern) => matchPatternToRegex(pattern) ?? []);
  const addRules = regexes.map((regexFilter, index) => ({
    id: index + 1,
    action: {
      type: 'redirect' as Browser.declarativeNetRequest.RuleActionType,
      // \0 is the full original URL, which the gate needs to send the user on.
      redirect: { regexSubstitution: `${gate}#\\0` },
    },
    condition: {
      regexFilter,
      resourceTypes: ['main_frame' as Browser.declarativeNetRequest.ResourceType],
    },
  }));

  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules,
  });

  // Wake up when the next pass ends so its site gets redirected again.
  const expiry = nextPassExpiry(session, now);
  if (expiry) await browser.alarms.create(passAlarm, { when: expiry });
  else await browser.alarms.clear(passAlarm);
}

/** Asks the background to sync and waits until it has. */
export async function syncRedirectsNow(): Promise<void> {
  await browser.runtime.sendMessage({ type: syncMessage });
}

export function isSyncRequest(message: unknown): boolean {
  return (message as { type?: unknown } | null)?.type === syncMessage;
}
