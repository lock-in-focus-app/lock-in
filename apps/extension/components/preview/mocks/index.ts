import type { Component } from 'vue';
import BlueskyHome from './BlueskyHome.vue';
import FacebookHome from './FacebookHome.vue';
import InstagramHome from './InstagramHome.vue';
import LinkedInHome from './LinkedInHome.vue';
import PinterestHome from './PinterestHome.vue';
import PinterestPin from './PinterestPin.vue';
import RedditHome from './RedditHome.vue';
import ThreadsHome from './ThreadsHome.vue';
import TikTokHome from './TikTokHome.vue';
import TwitchChannel from './TwitchChannel.vue';
import TwitchHome from './TwitchHome.vue';
import XHome from './XHome.vue';
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
  x: [
    {
      id: 'home',
      label: 'Home',
      address: 'x.com/home',
      component: XHome,
      toggles: ['hideHomeTimeline', 'hideTrending', 'hideWhoToFollow', 'hidePromoted'],
    },
  ],
  instagram: [
    {
      id: 'home',
      label: 'Home',
      address: 'instagram.com',
      component: InstagramHome,
      toggles: ['hideHomeFeed', 'hideExplore', 'hideReels'],
    },
  ],
  tiktok: [
    {
      id: 'home',
      label: 'For You',
      address: 'tiktok.com',
      component: TikTokHome,
      toggles: ['hideForYou', 'hideExplore', 'hideLive'],
    },
  ],
  facebook: [
    {
      id: 'home',
      label: 'Home',
      address: 'facebook.com',
      component: FacebookHome,
      toggles: ['hideNewsFeed', 'hideReels'],
    },
  ],
  linkedin: [
    {
      id: 'home',
      label: 'Home',
      address: 'linkedin.com/feed',
      component: LinkedInHome,
      toggles: ['hideFeed', 'hideNews'],
    },
  ],
  pinterest: [
    {
      id: 'home',
      label: 'Home',
      address: 'pinterest.com',
      component: PinterestHome,
      toggles: ['hideHomeFeed', 'hideExplore', 'hideSearchSuggestions'],
    },
    {
      id: 'pin',
      label: 'Pin',
      address: 'pinterest.com/pin',
      component: PinterestPin,
      toggles: ['hideMoreLikeThis', 'hideExplore'],
    },
  ],
  twitch: [
    {
      id: 'home',
      label: 'Home',
      address: 'twitch.tv',
      component: TwitchHome,
      toggles: ['hideFrontPage', 'hideRecommended'],
    },
    {
      id: 'channel',
      label: 'Stream',
      address: 'twitch.tv/channel',
      component: TwitchChannel,
      toggles: ['hideChat', 'hideRecommended'],
    },
  ],
  threads: [
    {
      id: 'home',
      label: 'Home',
      address: 'threads.com',
      component: ThreadsHome,
      toggles: ['hideHomeFeed'],
    },
  ],
  bluesky: [
    {
      id: 'home',
      label: 'Home',
      address: 'bsky.app',
      component: BlueskyHome,
      toggles: ['hideHomeFeed', 'hideTrending', 'hideCounts'],
    },
  ],
};
