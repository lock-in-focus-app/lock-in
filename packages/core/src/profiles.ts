import type { Profile } from './types';

/**
 * Profiles every new install starts with. They're ordinary, editable profiles that
 * show off what's possible. Deep Work joins once redirects exist.
 */
export const starterProfiles: Profile[] = [
  {
    id: 'writing',
    name: 'Writing',
    sites: [{ recipeId: 'reddit', level: 'tamed', toggles: { grayscale: true } }],
  },
  {
    id: 'wind-down',
    name: 'Wind Down',
    sites: [{ recipeId: 'reddit', level: 'tamed' }],
  },
];
