// Shared types, schemas, and logic for Lock In (profiles, recipes, sessions, rewards).
export type * from './types';
// Types shared with the desktop app, generated from its Rust code.
export type * from './generated/ActiveSession';
export type * from './generated/Activity';
export type * from './generated/AppAction';
export type * from './generated/AppRule';
export type * from './generated/EndReason';
export type * from './generated/GateVisitRecord';
export type * from './generated/InstalledApp';
export type * from './generated/KnownBrowser';
export type * from './generated/ProfileSummary';
export type * from './generated/Satellite';
export type * from './generated/SatelliteAction';
export type * from './generated/SatelliteRecord';
export type * from './generated/SatelliteState';
export type * from './generated/SessionRecord';
export type * from './generated/Settings';
export type * from './generated/Snapshot';
export type * from './generated/Strictness';
export type * from './generated/TimerEnd';
export type * from './generated/TimerSettings';
export { matchesPattern, matchPatternToRegex, parseHttpUrl } from './match';
export { buildRecipeCss, cssForPage, findRecipe, isSafeSelector, pagePathAttribute, resolveToggles } from './recipe';
export {
  findRule,
  maxProfileNameLength,
  withNewProfile,
  withProfileDuplicated,
  withProfileMoved,
  withProfileRemoved,
  withProfilesRemoved,
  withProfileRenamed,
  withPathRuleRemoved,
  withPathRules,
  withProfileToggle,
  withRedirectSettings,
  withSessionOverridesSaved,
  withSessionToggle,
  withSiteLevel,
  withStarterProfilesReset,
} from './edits';
export {
  attemptsToday,
  checkOpenPage,
  hasPass,
  maxIntentionLength,
  nextPassExpiry,
  redirectRules,
  siteAccess,
  withGateVisit,
  withGateVisitContinued,
  withGateVisitWhy,
  withPass,
  type OpenPageCheck,
  type RedirectRule,
} from './redirect';
export {
  findPathRule,
  levelFor,
  maxPathLength,
  maxPathRules,
  normalizePath,
  pathMatches,
  pathRegexSource,
} from './paths';
export {
  defaultRedirectSettings,
  defaultWaits,
  redirectDestinations,
  redirectSettingsFor,
  waitSecondsFor,
} from './settings';
export { pickDestination, pickLink, pickQuote } from './destinations';
export { starterProfiles } from './profiles';
export { endLock, formatClock, timerStatus, unlockText, type TimerStatus } from './timer';
export {
  cleanedSatelliteText,
  doneTasksShownMs,
  maxSatelliteLength,
  withSatelliteAction,
  withSatelliteLaunched,
  withSatellitesBack,
} from './satellites';
export {
  addWeeks,
  formatDuration,
  formatHour,
  formatHourRange,
  weeklyReport,
  weekStart,
  type DistractionSummary,
  type FocusSummary,
  type SatelliteSummary,
  type SiteDistractions,
  type WeeklyReport,
} from './insights';
export { desktopHostName, linkProtocol, type FromDesktop, type Synced, type ToDesktop } from './link';
