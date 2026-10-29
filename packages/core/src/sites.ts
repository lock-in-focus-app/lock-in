import { findRecipe } from './recipe';
import type { Profile, SiteLevel, SiteRecipe, SiteRule } from './types';

// Sites people add themselves, beyond the built-in recipes: any site, by its address. Each is
// kept in the profile like any other site, with the address in its id ("site:example.com"), so
// it syncs to the desktop app as it is. With no recipe, taming one hides only the parts of its
// page picked with the extension's element picker.

const ownSitePrefix = 'site:';

/** Most sites of their own one profile can have. */
export const maxOwnSites = 100;

/**
 * Tidies an address someone typed, or the tab they're on: "https://www.Example.com/page" becomes
 * "example.com". Returns undefined for anything that isn't a site's address, like an IP address,
 * a single word or a page that isn't on the web.
 */
export function siteDomain(raw: string): string | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/:]+:\d/.test(text) ? text : `https://${text}`);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

  const domain = url.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  const labels = domain.split('.');
  const valid =
    domain.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => /^[a-z\d]([a-z\d-]{0,61}[a-z\d])?$/.test(label)) &&
    !/^\d+$/.test(labels[labels.length - 1]!);
  return valid ? domain : undefined;
}

export function ownSiteId(domain: string): string {
  return `${ownSitePrefix}${domain}`;
}

/** The address of a site someone added, from its id, or undefined for a built-in site. */
export function ownSiteDomain(recipeId: string): string | undefined {
  return recipeId.startsWith(ownSitePrefix) ? recipeId.slice(ownSitePrefix.length) : undefined;
}

/** The match pattern for a site someone added. `*.` covers the bare address and everything under it. */
export function ownSitePattern(domain: string): string {
  return `*://*.${domain}/*`;
}

/**
 * A site someone added, as a recipe with no toggles, so it works everywhere recipes do. Taming it
 * hides the parts of its page picked with the element picker.
 */
export function ownSiteRecipe(domain: string): SiteRecipe {
  return { id: ownSiteId(domain), name: domain, matches: [ownSitePattern(domain)], toggles: [] };
}

/**
 * Every site the profiles know about: the built-in recipes first, so a site that has one always
 * uses it, then each site added to any profile, once. The longest addresses come first, so
 * "news.example.com" is found before "example.com".
 */
export function siteRecipes(builtIn: readonly SiteRecipe[], profiles: readonly Profile[]): SiteRecipe[] {
  const domains = new Set(
    profiles.flatMap((profile) =>
      profile.sites.flatMap((site) => {
        const domain = ownSiteDomain(site.recipeId);
        return domain && siteDomain(domain) === domain ? [domain] : [];
      }),
    ),
  );
  const own = [...domains].sort((a, b) => b.length - a.length).map(ownSiteRecipe);
  return [...builtIn, ...own];
}

/** A site's name, for showing: its recipe's name, or the address of one someone added. */
export function siteName(recipes: readonly SiteRecipe[], recipeId: string): string {
  return recipes.find((recipe) => recipe.id === recipeId)?.name ?? ownSiteDomain(recipeId) ?? recipeId;
}

/**
 * The site an address belongs to: a built-in one if it has a recipe (so "old.reddit.com" is
 * Reddit), else one to add as the user's own. Undefined for anything that isn't an address.
 */
export function siteFor(builtIn: readonly SiteRecipe[], raw: string): SiteRecipe | undefined {
  const domain = siteDomain(raw);
  if (!domain) return undefined;
  return findRecipe(builtIn, `https://${domain}/`) ?? ownSiteRecipe(domain);
}

/** Takes a site off a profile, so it's allowed again, with its toggles and page rules gone. */
export function withSiteRemoved(profiles: readonly Profile[], profileId: string, recipeId: string): Profile[] {
  return profiles.map((profile) =>
    profile.id === profileId
      ? { ...profile, sites: profile.sites.filter((site) => site.recipeId !== recipeId) }
      : profile,
  );
}

/** Whether a profile can take another site of its own. */
export function hasRoomForOwnSite(profile: Profile | undefined): boolean {
  return (profile?.sites.filter((site) => ownSiteDomain(site.recipeId)).length ?? 0) < maxOwnSites;
}

/** What each level does, in the words the app and the extension both show, least strict first. */
export const siteLevels: readonly { id: SiteLevel; label: string; detail: string }[] = [
  { id: 'allowed', label: 'Allowed', detail: 'Left alone.' },
  { id: 'tamed', label: 'Tamed', detail: 'Stays open, with the distracting parts hidden, like feeds and Shorts.' },
  {
    id: 'redirected',
    label: 'Redirected',
    detail: 'Sends you to a Lock In page first, with a way through for a few minutes.',
  },
  { id: 'restricted', label: 'Restricted', detail: 'Shut, with no way through until the session ends.' },
];

const strictness: Record<SiteLevel, number> = { allowed: 0, tamed: 1, redirected: 2, restricted: 3 };

/** Whether `level` keeps less away than `than`. */
export function isLooser(level: SiteLevel, than: SiteLevel): boolean {
  return strictness[level] < strictness[than];
}

/**
 * Whether `after` lets through anything `before` kept away: a site or page at a looser level, one
 * taken off, or a hidden part shown again. A new page rule can't be looser than anything already set on its site. Not
 * allowed during a Hard session (the desktop app checks the same in sites.rs).
 */
export function sitesLooser(before: readonly SiteRule[], after: readonly SiteRule[]): boolean {
  const samePath = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return before.some((old) => {
    const kept = after.find((site) => site.recipeId === old.recipeId);
    const level = kept?.level ?? 'allowed';
    if (isLooser(level, old.level)) return true;

    const oldPages = old.paths ?? [];
    const pages = kept?.paths ?? [];
    const pageLoosened = oldPages.some((page) => {
      const now = pages.find((p) => samePath(p.path, page.path))?.level ?? level;
      return isLooser(now, page.level);
    });
    const strictest = [old.level, ...oldPages.map((page) => page.level)].reduce((a, b) => (isLooser(a, b) ? b : a));
    const newPageLooser = pages.some(
      (page) => !oldPages.some((p) => samePath(p.path, page.path)) && isLooser(page.level, strictest),
    );
    const shownAgain = (old.hidden ?? []).some(
      (part) => !(kept?.hidden ?? []).some((p) => p.selector === part.selector),
    );
    return pageLoosened || newPageLooser || shownAgain;
  });
}
