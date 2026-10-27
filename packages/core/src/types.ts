import type { AppRule } from './generated/AppRule';
import type { TimerSettings } from './generated/TimerSettings';

/**
 * How a site behaves during a session: left alone, tamed with its recipe, redirected
 * to a page you can get through with a pass, or restricted with no way through.
 */
export type SiteLevel = 'allowed' | 'tamed' | 'redirected' | 'restricted';

/** A single on/off switch in a site recipe, e.g. "Hide home feed". */
export interface RecipeToggle {
  id: string;
  label: string;
  /**
   * CSS selectors for elements hidden while the toggle is on. To hide something on some
   * pages only, start the selector with the page path the extension keeps on `<html>`,
   * e.g. `html[data-lock-in-path^="/explore"] main`.
   */
  selectors?: string[];
  /** A whole-page effect applied while the toggle is on. */
  effect?: 'grayscale';
  /** Whether the toggle is on when a profile doesn't override it. */
  default: boolean;
}

/** Defines what "tamed" means for one site. */
export interface SiteRecipe {
  id: string;
  name: string;
  /** Browser match patterns, e.g. "*://*.reddit.com/*". */
  matches: string[];
  toggles: RecipeToggle[];
  /** Pages people often want handled differently, offered as one-click page rules (e.g. YouTube Shorts). */
  pages?: SuggestedPages[];
  /** Where the selectors came from, for attribution. */
  source?: string;
}

/** A named group of paths, e.g. "For You" on TikTok is both "/" and "/foryou". */
export interface SuggestedPages {
  label: string;
  paths: string[];
}

/**
 * A different level for some pages of a site, e.g. redirecting YouTube's /shorts while
 * the rest of YouTube is tamed.
 */
export interface PathRule {
  /**
   * "/" is the home page only. Any other path also covers everything under it, and `*`
   * matches within one part of the path. Matching ignores case.
   */
  path: string;
  level: SiteLevel;
}

/** How one site is treated by a profile. */
export interface SiteRule {
  recipeId: string;
  level: SiteLevel;
  /** Overrides for the recipe's toggle defaults, keyed by toggle id. */
  toggles?: Record<string, boolean>;
  /** Pages that don't follow the site's level. The most specific match wins. */
  paths?: PathRule[];
}

/** A reusable session setup, e.g. "Writing" or "Wind Down". */
export interface Profile {
  id: string;
  name: string;
  sites: SiteRule[];
  /** The color of this profile's stars in the night sky, e.g. "#f5c86b". Missing, it falls back to a default. */
  starColor?: string;
  /** The quiet timer, run by the desktop app. Missing fields fall back to its defaults. */
  timer?: Partial<TimerSettings>;
  /** Desktop apps closed or hidden during sessions, set in the desktop app. */
  apps?: AppRule[];
  /** How redirected sites behave. Missing fields fall back to the defaults. */
  redirect?: {
    destinations?: RedirectDestination[];
    gate?: Partial<GateSettings>;
    links?: SavedLink[];
  };
}

/** The pages a redirected site can send you to. */
export type RedirectDestination = 'gate' | 'quote' | 'link' | 'stuck';

/** What happens to a site's open tabs once its pass runs out. */
export type PassExpiry = 'nothing' | 'pause' | 'redirect';

/** How long Continue stays disabled on the intention gate. */
export type GateWait =
  | { mode: 'fixed'; seconds: number }
  /** Starts short and grows with each attempt at the same site today, up to a cap. */
  | { mode: 'escalating'; startSeconds: number; stepSeconds: number; maxSeconds: number };

export interface GateSettings {
  /** Whether Continue needs a typed reason. */
  requireReason: boolean;
  wait: GateWait;
  /** How long a pass to a redirected site lasts. */
  passMinutes: number;
  onPassExpiry: PassExpiry;
}

/** One of the user's own links, e.g. their draft or reading list. */
export interface SavedLink {
  id: string;
  title: string;
  url: string;
}

/** How a profile handles redirected sites. */
export interface RedirectSettings {
  /** Which pages to show. One is picked at random for each visit. */
  destinations: RedirectDestination[];
  gate: GateSettings;
  links: SavedLink[];
}

export interface Quote {
  text: string;
  author?: string;
}

/** A quote the user added themselves. */
export interface OwnQuote extends Quote {
  id: string;
}

/** The one-tap answer to "why are you here?" on redirect pages. */
export type WhyReason = 'bored' | 'stuck' | 'tired' | 'curious';

/** Toggle values keyed by recipe id, then toggle id. */
export type ToggleOverrides = Record<string, Record<string, boolean>>;

/** The session currently running, if any. */
export interface Session {
  id: string;
  profileId: string;
  /** Epoch milliseconds. */
  startedAt: number;
  /** The quiet timer, copied from the profile when the desktop app starts or picks up the session. */
  timer?: TimerSettings;
  /** Toggles changed for this session only. They don't touch the profile unless saved. */
  overrides?: ToggleOverrides;
  /** Redirected sites the user chose to continue to, keyed by recipe id. Each value is when the pass ends (epoch ms). */
  passes?: Record<string, number>;
}

/** One trip to a redirected site, kept for the attempt counter and, later, insights. */
export interface GateVisit {
  id: string;
  recipeId: string;
  /** Epoch milliseconds. */
  at: number;
  /** The page the visit was sent to. "blocked" is the page for restricted sites. */
  destination?: RedirectDestination | 'blocked';
  /** The user's one-tap answer to "why are you here?". */
  why?: WhyReason;
  /** What the user said they came for, if they typed anything. */
  intention?: string;
  /** Whether they used a pass to continue to the site. */
  continued?: boolean;
}
