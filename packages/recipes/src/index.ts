import type { SiteRecipe } from '@lock-in/core';
import reddit from './reddit.json';

/** Built-in site recipes. Each lives in its own JSON file so it's easy to edit and share. */
export const recipes: SiteRecipe[] = [reddit as SiteRecipe];
