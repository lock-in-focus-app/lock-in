import type { Component } from 'vue';
import RedditHome from './RedditHome.vue';
import YouTubeHome from './YouTubeHome.vue';
import YouTubeWatch from './YouTubeWatch.vue';

/** One drawing of a site, and the toggles that change something on it. */
export interface MockPage {
  id: string;
  label: string;
  /** Shown in the drawing's address bar. */
  address: string;
  component: Component;
  toggles: string[];
}

/** Preview drawings, keyed by recipe id. Sites without one just show their toggles. */
export const mocks: Record<string, MockPage[]> = {
  reddit: [
    {
      id: 'home',
      label: 'Home',
      address: 'reddit.com',
      component: RedditHome,
      toggles: ['hideFeeds', 'hideTrending', 'hideSuggested', 'hidePromoted'],
    },
  ],
  youtube: [
    {
      id: 'home',
      label: 'Home',
      address: 'youtube.com',
      component: YouTubeHome,
      toggles: ['hideHomeFeed', 'hideShorts'],
    },
    {
      id: 'watch',
      label: 'Video',
      address: 'youtube.com/watch',
      component: YouTubeWatch,
      toggles: ['hideRecommendations', 'hideEndScreen', 'hideComments', 'hideShorts'],
    },
  ],
};
