import type { SiteRecipe } from '@lock-in/core';
import bluesky from './bluesky.json';
import facebook from './facebook.json';
import instagram from './instagram.json';
import linkedin from './linkedin.json';
import pinterest from './pinterest.json';
import reddit from './reddit.json';
import threads from './threads.json';
import tiktok from './tiktok.json';
import twitch from './twitch.json';
import x from './x.json';
import youtube from './youtube.json';

/** Built-in site recipes. Each lives in its own JSON file so it's easy to edit and share. */
export const recipes: SiteRecipe[] = [
  reddit,
  youtube,
  x,
  instagram,
  tiktok,
  facebook,
  linkedin,
  pinterest,
  twitch,
  threads,
  bluesky,
] as SiteRecipe[];
