import { matchesPattern } from './match';
import type { Profile, Session, SiteRecipe, SiteRule } from './types';

/**
 * While a site is tamed, the extension keeps the page's path in this attribute on
 * `<html>` and updates it as single-page apps navigate. CSS can't see the URL, so this
 * is how a recipe hides something on some pages only.
 */
export const pagePathAttribute = 'data-lock-in-path';

/**
 * Selectors end up inside a generated stylesheet, so anything that could close the rule
 * or start a new one (braces, semicolons, at-rules, comments, escapes) is rejected. This
 * matters for recipes imported from other people.
 */
export function isSafeSelector(selector: string): boolean {
  return selector.trim().length > 0 && !/[{};@\\]|\/\*/.test(selector);
}

export function findRecipe(recipes: readonly SiteRecipe[], url: string | URL): SiteRecipe | undefined {
  return recipes.find((recipe) => recipe.matches.some((pattern) => matchesPattern(pattern, url)));
}

/**
 * The value of every toggle in a recipe: the recipe's defaults, then the profile's
 * overrides, then any changes made for the current session.
 */
export function resolveToggles(
  recipe: SiteRecipe,
  rule: SiteRule | undefined,
  sessionOverrides?: Record<string, boolean>,
): Record<string, boolean> {
  return Object.fromEntries(
    recipe.toggles.map((toggle) => [
      toggle.id,
      sessionOverrides?.[toggle.id] ?? rule?.toggles?.[toggle.id] ?? toggle.default,
    ]),
  );
}

/** Builds the stylesheet that tames a site with the given toggles switched on. */
export function buildRecipeCss(recipe: SiteRecipe, toggles: Record<string, boolean>): string {
  const enabled = recipe.toggles.filter((toggle) => toggles[toggle.id]);
  const selectors = enabled.flatMap((toggle) => toggle.selectors ?? []).filter(isSafeSelector);

  const rules: string[] = [];
  if (selectors.length > 0) {
    rules.push(`${selectors.join(',\n')} {\n  display: none !important;\n}`);
  }
  if (enabled.some((toggle) => toggle.effect === 'grayscale')) {
    rules.push('html {\n  filter: grayscale(1) !important;\n}');
  }
  return rules.join('\n\n');
}

/** The CSS to inject into a page for the active session, or an empty string. */
export function cssForPage(options: {
  url: string | URL;
  session: Session | null;
  profiles: readonly Profile[];
  recipes: readonly SiteRecipe[];
}): string {
  const { url, session, profiles, recipes } = options;
  if (!session) return '';

  const profile = profiles.find((p) => p.id === session.profileId);
  const recipe = findRecipe(recipes, url);
  if (!profile || !recipe) return '';

  const rule = profile.sites.find((site) => site.recipeId === recipe.id);
  if (rule?.level !== 'tamed') return '';

  return buildRecipeCss(recipe, resolveToggles(recipe, rule, session.overrides?.[recipe.id]));
}
