/** How a site behaves during a session. */
export type SiteLevel = 'allowed' | 'tamed' | 'redirected';

/** A single on/off switch in a site recipe, e.g. "Hide home feed". */
export interface RecipeToggle {
  id: string;
  label: string;
  /** CSS selectors for elements hidden while the toggle is on. */
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
  /** Where the selectors came from, for attribution. */
  source?: string;
}

/** How one site is treated by a profile. */
export interface SiteRule {
  recipeId: string;
  level: SiteLevel;
  /** Overrides for the recipe's toggle defaults, keyed by toggle id. */
  toggles?: Record<string, boolean>;
}

/** A reusable session setup, e.g. "Writing" or "Wind Down". */
export interface Profile {
  id: string;
  name: string;
  sites: SiteRule[];
}

/** Toggle values keyed by recipe id, then toggle id. */
export type ToggleOverrides = Record<string, Record<string, boolean>>;

/** The session currently running, if any. */
export interface Session {
  id: string;
  profileId: string;
  /** Epoch milliseconds. */
  startedAt: number;
  /** Toggles changed for this session only. They don't touch the profile unless saved. */
  overrides?: ToggleOverrides;
  /** Redirected sites the user chose to continue to, keyed by recipe id. Each value is when the pass ends (epoch ms). */
  passes?: Record<string, number>;
}

/** One trip to the intention gate, kept for the attempt counter and, later, insights. */
export interface GateVisit {
  id: string;
  recipeId: string;
  /** Epoch milliseconds. */
  at: number;
  /** What the user said they came for, if they typed anything. */
  intention?: string;
  /** Whether they used a pass to continue to the site. */
  continued?: boolean;
}
