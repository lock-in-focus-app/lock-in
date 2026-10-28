import { siteName, type Profile } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';

/** A one-line summary of what a profile does, e.g. "Reddit tamed · grayscale, X redirected". */
export function profileSummary(profile: Profile): string {
  return (
    profile.sites
      .map((site) => {
        const name = siteName(recipes, site.recipeId);
        const pages = site.paths?.length
          ? ` · ${site.paths.length} page rule${site.paths.length === 1 ? '' : 's'}`
          : '';
        if (site.level === 'tamed' && site.toggles?.grayscale) return `${name} tamed · grayscale${pages}`;
        if (site.level === 'allowed') return pages ? `${name}${pages}` : '';
        return `${name} ${site.level}${pages}`;
      })
      .filter(Boolean)
      .join(', ') || 'Everything allowed'
  );
}
