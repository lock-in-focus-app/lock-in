import type { OwnQuote, Quote, RedirectDestination, RedirectSettings, SavedLink } from './types';

type Random = () => number;

/** How much more likely each of the user's own quotes is than a bundled one. */
const ownQuoteWeight = 3;

/** Picks which page to show for a redirected visit. "Your links" needs at least one link. */
export function pickDestination(settings: RedirectSettings, random: Random = Math.random): RedirectDestination {
  const usable = settings.destinations.filter((d) => d !== 'link' || settings.links.length > 0);
  return pick(usable, random) ?? 'gate';
}

/** A random quote, favoring the user's own. */
export function pickQuote(bundled: readonly Quote[], own: readonly OwnQuote[], random: Random = Math.random): Quote | undefined {
  const weighted = [...bundled, ...own.flatMap((quote) => Array<Quote>(ownQuoteWeight).fill(quote))];
  return pick(weighted, random);
}

export function pickLink(links: readonly SavedLink[], random: Random = Math.random): SavedLink | undefined {
  return pick(links, random);
}

function pick<T>(items: readonly T[], random: Random): T | undefined {
  return items[Math.floor(random() * items.length)];
}
