import {
  buildRecipeCss,
  checkOpenPage,
  cssForPage,
  endLock,
  findRecipe,
  maxHiddenParts,
  pagePathAttribute,
  siteAccess,
  siteRecipes,
  siteSettingsFor,
  type Profile,
  type Session,
  type SiteSettings,
} from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import type { Picker } from '@/utils/picker';

// Listed here for the built-in sites. The background adds sites people add themselves, once
// they've let Lock In reach them (ownSites.ts).
export default defineContentScript({
  matches: recipes.flatMap((recipe) => recipe.matches),
  runAt: 'document_start',
  main(ctx) {
    // One <style> element holds this page's recipe CSS. It's filled in, emptied, or
    // updated as sessions start and stop, so tabs that are already open react immediately.
    const style = document.createElement('style');
    style.dataset.lockIn = '';
    document.documentElement.append(style);

    // The session, profiles and site settings are kept here and updated by storage events, so
    // moving between pages doesn't read storage.
    let session: Session | null = null;
    let profileList: Profile[] = [];
    let sites: SiteSettings[] = [];
    let known = recipes;
    let url = new URL(location.href);

    // While the element picker is open (from the popup), it decides what's hidden of the parts
    // picked on this site, in a session or not, so you see what Done would save before saving it.
    let picking: { recipeId: string } | undefined;
    let picker: Picker | undefined;
    const pickStyle = document.createElement('style');
    pickStyle.dataset.lockInPicker = '';

    let removeOverlay: (() => void) | undefined;
    let overlayKey = '';
    let recheck: number | undefined;

    const savedWhilePicking = () => (picking && siteSettingsFor(sites, picking.recipeId)?.hidden) ?? [];
    // The site settings as the page's own stylesheet sees them: while picking, without the parts
    // the picker is showing or hiding itself.
    const tamingSites = () =>
      picking
        ? sites.map((site) => (site.recipeId === picking!.recipeId ? { ...site, hidden: undefined } : site))
        : sites;

    const apply = (navigated = false) => {
      picker?.refresh();
      style.textContent = cssForPage({
        url,
        session,
        profiles: profileList,
        recipes: known,
        siteSettings: tamingSites(),
      });

      // Recipes can hide things on some pages only by matching the path kept on <html>.
      // It's only there while the page is tamed.
      if (style.textContent) document.documentElement.setAttribute(pagePathAttribute, url.pathname);
      else document.documentElement.removeAttribute(pagePathAttribute);

      // Single-page apps change pages without loading one, so the browser's redirect rules
      // never see it. Moving onto a redirected or restricted page is caught here instead.
      if (navigated) {
        const recipe = findRecipe(known, url);
        const access = recipe
          ? siteAccess({ session, profiles: profileList, recipeId: recipe.id, path: url.pathname, now: Date.now() })
          : 'open';
        if (access !== 'open') {
          // Let the site finish its own navigation first, so Back returns to the page before.
          const target = url.href;
          ctx.setTimeout(() => location.replace(redirectPageUrl(target)), 0);
          return;
        }
      }

      // Redirected and restricted pages only get this far if the tab was already open.
      const check = checkOpenPage({ url, session, profiles: profileList, recipes: known, now: Date.now() });
      clearTimeout(recheck);

      if (check.action === 'none') {
        removeOverlay?.();
        removeOverlay = undefined;
        overlayKey = '';
        if (check.recheckAt) recheck = ctx.setTimeout(() => apply(), check.recheckAt - Date.now() + 250);
      } else if (check.action === 'redirect') {
        location.replace(redirectPageUrl(url.href, { expired: check.passExpired }));
      } else {
        const restricted = check.action === 'block';
        const reason = restricted ? 'restricted' : check.passExpired ? 'expired' : 'open-before';
        // Only redraw the cover when what it says would change.
        const key = `${reason}:${check.profile.name}`;
        if (key === overlayKey) return;

        removeOverlay?.();
        overlayKey = key;
        removeOverlay = showPauseOverlay({
          siteName: check.recipe.name,
          profileName: check.profile.name,
          reason,
          onStillNeed: restricted ? undefined : () => location.assign(redirectPageUrl(url.href)),
          onClose: () => void closeThisTab(),
        });
      }
    };

    function startPicking(recipeId: string) {
      const recipe = known.find((r) => r.id === recipeId);
      if (!recipe) return false;
      picker?.close();
      document.documentElement.append(pickStyle);
      // The page's own stylesheet leaves the saved parts to the picker's preview from here on.
      picking = { recipeId };
      picker = showPicker({
        siteName: recipe.name,
        saved: savedWhilePicking,
        locked: () => !!session && endLock(session, Date.now()) === 'hard',
        maxParts: maxHiddenParts,
        partFor: hiddenPartFor,
        pickable,
        preview: (parts) => {
          pickStyle.textContent = buildRecipeCss({ ...recipe, toggles: [] }, {}, parts);
        },
        onDone: async (change) => {
          await changeHiddenParts(recipeId, change);
          stopPicking();
        },
        onCancel: stopPicking,
      });
      apply();
      return true;
    }
    function stopPicking() {
      picker?.close();
      picker = undefined;
      picking = undefined;
      pickStyle.remove();
      apply();
    }
    // The popup's "Hide parts of this page" asks for the picker on this tab.
    const onMessage = (message: unknown, _sender: unknown, sendResponse: (started: boolean) => void) => {
      const ask = message as { type?: string; recipeId?: string } | undefined;
      if (ask?.type !== 'lock-in:pick' || !ask.recipeId) return;
      sendResponse(startPicking(ask.recipeId));
    };
    browser.runtime.onMessage.addListener(onMessage);

    void Promise.all([activeSession.getValue(), profiles.getValue(), siteSettings.getValue()]).then(
      ([s, p, settings]) => {
        session = s;
        profileList = p;
        sites = settings;
        known = siteRecipes(recipes, p, settings);
        apply();
      },
    );
    const unwatchSession = activeSession.watch((value) => {
      session = value;
      apply();
    });
    const unwatchProfiles = profiles.watch((value) => {
      profileList = value;
      known = siteRecipes(recipes, value, sites);
      apply();
    });
    const unwatchSites = siteSettings.watch((value) => {
      sites = value;
      known = siteRecipes(recipes, profileList, value);
      apply();
    });
    // Fired as single-page apps navigate, before the new page shows.
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      const pageChanged = newUrl.pathname !== url.pathname;
      url = newUrl;
      if (pageChanged) apply(true);
    });
    // Timers in background tabs can run late, so check again whenever the tab comes back.
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') apply();
    });
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(onMessage);
      stopPicking();
      unwatchSession();
      unwatchProfiles();
      unwatchSites();
      style.remove();
      document.documentElement.removeAttribute(pagePathAttribute);
      removeOverlay?.();
    });
  },
});
