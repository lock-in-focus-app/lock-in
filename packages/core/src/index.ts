// Shared types, schemas, and logic for Lock In (profiles, recipes, sessions, rewards).
export type * from './types';
export { matchesPattern, matchPatternToRegex, parseHttpUrl } from './match';
export { buildRecipeCss, cssForPage, findRecipe, isSafeSelector, resolveToggles } from './recipe';
export {
  findRule,
  withProfileToggle,
  withRedirectSettings,
  withSessionOverridesSaved,
  withSessionToggle,
} from './edits';
export {
  attemptsToday,
  checkOpenPage,
  hasPass,
  maxIntentionLength,
  nextPassExpiry,
  redirectedRecipes,
  withGateVisit,
  withGateVisitContinued,
  withGateVisitWhy,
  withPass,
  type OpenPageCheck,
} from './redirect';
export { defaultRedirectSettings, defaultWaits, redirectDestinations, redirectSettingsFor, waitSecondsFor } from './settings';
export { pickDestination, pickLink, pickQuote } from './destinations';
export { starterProfiles } from './profiles';
