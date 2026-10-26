import { checkOpenPage, cssForPage } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';

export default defineContentScript({
  matches: recipes.flatMap((recipe) => recipe.matches),
  runAt: 'document_start',
  main(ctx) {
    // One <style> element holds this page's recipe CSS. It's filled in, emptied, or
    // updated as sessions start and stop, so tabs that are already open react immediately.
    const style = document.createElement('style');
    style.dataset.lockIn = '';
    document.documentElement.append(style);

    let removeOverlay: (() => void) | undefined;
    let recheck: number | undefined;

    const apply = async () => {
      const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
      style.textContent = cssForPage({ url: location.href, session, profiles: profileList, recipes });

      // Redirected sites only get this far if the tab was already open, so follow the
      // profile's "when a pass runs out" setting.
      const check = checkOpenPage({ url: location.href, session, profiles: profileList, recipes, now: Date.now() });
      clearTimeout(recheck);

      if (check.action === 'none') {
        removeOverlay?.();
        removeOverlay = undefined;
        if (check.recheckAt) recheck = ctx.setTimeout(apply, check.recheckAt - Date.now() + 250);
      } else if (check.action === 'redirect') {
        location.replace(redirectPageUrl(location.href, { expired: check.passExpired }));
      } else {
        removeOverlay ??= showPauseOverlay({
          siteName: check.recipe.name,
          profileName: check.profile.name,
          passExpired: check.passExpired,
          onStillNeed: () => location.assign(redirectPageUrl(location.href)),
          onClose: () => void closeThisTab(),
        });
      }
    };

    void apply();
    const unwatchSession = activeSession.watch(apply);
    const unwatchProfiles = profiles.watch(apply);
    // Timers in background tabs can run late, so check again whenever the tab comes back.
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') void apply();
    });
    ctx.onInvalidated(() => {
      unwatchSession();
      unwatchProfiles();
      style.remove();
      removeOverlay?.();
    });
  },
});
