import type { Profile } from './types';

/** Profiles every new install starts with. They're ordinary, editable profiles that show off what's possible. */
export const starterProfiles: Profile[] = [
  {
    id: 'writing',
    name: 'Writing',
    sites: [
      { recipeId: 'reddit', level: 'tamed', toggles: { grayscale: true } },
      {
        recipeId: 'youtube',
        level: 'tamed',
        toggles: { grayscale: true },
        paths: [{ path: '/shorts', level: 'redirected' }],
      },
      { recipeId: 'x', level: 'redirected' },
      { recipeId: 'instagram', level: 'redirected' },
      { recipeId: 'tiktok', level: 'redirected' },
      { recipeId: 'facebook', level: 'redirected' },
    ],
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    sites: [
      { recipeId: 'reddit', level: 'redirected' },
      { recipeId: 'youtube', level: 'redirected' },
      { recipeId: 'x', level: 'redirected' },
      { recipeId: 'instagram', level: 'redirected' },
      { recipeId: 'tiktok', level: 'redirected' },
      { recipeId: 'facebook', level: 'redirected' },
      { recipeId: 'linkedin', level: 'redirected' },
      { recipeId: 'pinterest', level: 'redirected' },
    ],
    redirect: {
      destinations: ['gate', 'quote', 'stuck'],
      gate: { wait: { mode: 'escalating', startSeconds: 5, stepSeconds: 5, maxSeconds: 60 } },
    },
  },
  {
    id: 'wind-down',
    name: 'Wind Down',
    sites: [
      { recipeId: 'reddit', level: 'tamed' },
      { recipeId: 'youtube', level: 'tamed', paths: [{ path: '/shorts', level: 'redirected' }] },
      { recipeId: 'instagram', level: 'tamed', paths: [{ path: '/reels', level: 'redirected' }] },
    ],
  },
];
