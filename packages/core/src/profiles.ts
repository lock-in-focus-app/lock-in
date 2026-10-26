import type { Profile } from './types';
import starters from './starter-profiles.json' with { type: 'json' };

/**
 * Profiles every new install starts with. They're ordinary, editable profiles that show off
 * what's possible. They live in JSON so the desktop app can read the same list.
 */
export const starterProfiles = starters as Profile[];
