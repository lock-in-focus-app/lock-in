import type { Profile } from './types';

/** Profiles every new install starts with. They're ordinary, editable profiles that show off what's possible. */
export const starterProfiles: Profile[] = [
  {
    id: 'writing',
    name: 'Writing',
    sites: [
      { recipeId: 'reddit', level: 'tamed', toggles: { grayscale: true } },
      { recipeId: 'x', level: 'redirected' },
    ],
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    sites: [
      { recipeId: 'reddit', level: 'redirected' },
      { recipeId: 'x', level: 'redirected' },
    ],
  },
  {
    id: 'wind-down',
    name: 'Wind Down',
    sites: [{ recipeId: 'reddit', level: 'tamed' }],
  },
];
