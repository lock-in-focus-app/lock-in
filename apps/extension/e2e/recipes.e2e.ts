import type { Profile } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, setStored, startSession, urls, visibility, type TestBrowser } from './harness';

// Every built-in recipe, tamed with every toggle on, against its fixture page.
const everything: Profile = {
  id: 'everything',
  name: 'Everything',
  sites: recipes.map((recipe) => ({
    recipeId: recipe.id,
    level: 'tamed',
    toggles: Object.fromEntries(recipe.toggles.map((toggle) => [toggle.id, true])),
  })),
};

describe('built-in recipes', () => {
  let t: TestBrowser;
  let control: Page;
  let tab: Page;

  /**
   * Single-page apps change the path without loading a new page. Lock In keeps the path it
   * has applied on <html> while a site is tamed, so this waits until it has caught up.
   */
  const pushPath = async (path: string) => {
    await tab.evaluate((p) => history.pushState({}, '', p), path);
    await tab.waitForFunction(
      (p) => document.documentElement.getAttribute('data-lock-in-path') === new URL(p, location.href).pathname,
      {},
      path,
    );
  };

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
    await setStored(control, { profiles: [everything] });
    await startSession(control, 'everything');
    tab = await t.browser.newPage();
  });
  afterAll(() => t?.close());

  it('only uses selectors the browser understands', async () => {
    await tab.goto(urls.other);
    const selectors = recipes.flatMap((recipe) => recipe.toggles.flatMap((toggle) => toggle.selectors ?? []));
    const invalid = await tab.evaluate(
      (list) =>
        list.filter((selector) => {
          try {
            document.querySelector(selector);
            return false;
          } catch {
            return true;
          }
        }),
      selectors,
    );
    expect(invalid).toEqual([]);
  });

  it('tames YouTube', async () => {
    await tab.goto(urls.youtube);
    const ids = ['keep', 'shorts-nav', 'home', 'shorts-shelf', 'reel-shelf', 'endscreen', 'related', 'comments'];
    expect(await visibility(tab, ids)).toEqual({
      keep: true,
      'shorts-nav': false,
      home: false,
      'shorts-shelf': false,
      'reel-shelf': false,
      endscreen: false,
      related: false,
      comments: false,
      grayscale: true,
    });

    await pushPath('/feed/history');
    expect((await visibility(tab, ['reel-shelf']))['reel-shelf']).toBe(true);
  });

  it('tames X, following the page as it navigates', async () => {
    await tab.goto(urls.x);
    const ids = ['post', 'timeline', 'promoted', 'explore-tabs', 'trending', 'who-to-follow'];
    expect(await visibility(tab, ids)).toEqual({
      post: true,
      timeline: false,
      promoted: false,
      'explore-tabs': true,
      trending: false,
      'who-to-follow': false,
      grayscale: true,
    });

    await pushPath('/explore/tabs/for-you');
    expect(await visibility(tab, ['timeline', 'explore-tabs'])).toMatchObject({
      timeline: false,
      'explore-tabs': false,
    });

    await pushPath('/someone/status/1');
    expect(await visibility(tab, ['timeline', 'explore-tabs'])).toMatchObject({ timeline: true, 'explore-tabs': true });
  });

  it('tames Instagram', async () => {
    await tab.goto(urls.instagram);
    expect(await visibility(tab, ['keep', 'explore-link', 'reels-link', 'main'])).toEqual({
      keep: true,
      'explore-link': false,
      'reels-link': false,
      main: false,
      grayscale: true,
    });

    await pushPath('/explore/search/');
    expect((await visibility(tab, ['main'])).main).toBe(true);
    await pushPath('/explore/');
    expect((await visibility(tab, ['main'])).main).toBe(false);
    await pushPath('/someone/');
    expect((await visibility(tab, ['main'])).main).toBe(true);
  });

  it('tames TikTok', async () => {
    await tab.goto(urls.tiktok);
    expect(await visibility(tab, ['keep', 'explore-link', 'live-link', 'video', 'main'])).toEqual({
      keep: true,
      'explore-link': false,
      'live-link': false,
      video: false,
      main: false,
      grayscale: true,
    });

    await pushPath('/@someone');
    expect((await visibility(tab, ['main'])).main).toBe(true);
  });

  it('tames LinkedIn, keeping single posts', async () => {
    await tab.goto(urls.linkedin);
    expect(await visibility(tab, ['keep', 'feed', 'feed-news-module'])).toEqual({
      keep: true,
      feed: false,
      'feed-news-module': false,
      grayscale: true,
    });

    await pushPath('/feed/update/urn:li:activity:1/');
    expect((await visibility(tab, ['feed'])).feed).toBe(true);
  });

  it('tames Facebook', async () => {
    await tab.goto(urls.facebook);
    expect(await visibility(tab, ['keep', 'watch-link', 'reels-link', 'main'])).toEqual({
      keep: true,
      'watch-link': false,
      'reels-link': false,
      main: false,
      grayscale: true,
    });

    await pushPath('/groups/123');
    expect((await visibility(tab, ['main'])).main).toBe(true);
  });

  it('tames Pinterest', async () => {
    await tab.goto(urls.pinterest);
    expect(await visibility(tab, ['keep', 'explore-nav', 'suggestions', 'pin'])).toEqual({
      keep: true,
      'explore-nav': false,
      suggestions: false,
      pin: false,
      grayscale: true,
    });

    await pushPath('/search/pins/');
    expect((await visibility(tab, ['pin'])).pin).toBe(true);
    await pushPath('/pin/123/');
    expect((await visibility(tab, ['pin'])).pin).toBe(false);
  });

  it('tames Twitch, pausing the front page stream it hides', async () => {
    await tab.goto(urls.twitch);
    const ids = ['followed', 'recommended', 'also-watch', 'carousel', 'shelves', 'stream', 'chat'];
    expect(await visibility(tab, ids)).toEqual({
      followed: true,
      recommended: false,
      'also-watch': false,
      carousel: false,
      shelves: false,
      stream: true,
      chat: false,
      grayscale: true,
    });

    // Videos without a file to play: a blank canvas's stream plays like a live one. It never
    // sends a frame, so play() never settles, but a video counts as playing once it's asked to.
    const paused = () =>
      tab.evaluate(() =>
        ['carousel-video', 'stream'].map((id) => (document.getElementById(id) as HTMLVideoElement).paused),
      );
    await tab.evaluate(() => {
      for (const id of ['carousel-video', 'stream']) {
        const video = document.getElementById(id) as HTMLVideoElement;
        video.srcObject = document.createElement('canvas').captureStream();
        void video.play().catch(() => undefined);
      }
    });
    await expect.poll(paused).toEqual([true, false]);

    // One already playing is paused as it's hidden.
    await setStored(control, { activeSession: null });
    await expect.poll(async () => (await visibility(tab, ['carousel'])).carousel).toBe(true);
    await tab.evaluate(
      () => void (document.getElementById('carousel-video') as HTMLVideoElement).play().catch(() => undefined),
    );
    expect(await paused()).toEqual([false, false]);
    await startSession(control, 'everything');
    await expect.poll(paused).toEqual([true, false]);
  });

  it('tames Threads on the home page only', async () => {
    await tab.goto(urls.threads);
    expect(await visibility(tab, ['keep', 'feed'])).toEqual({ keep: true, feed: false, grayscale: true });

    await pushPath('/search');
    expect((await visibility(tab, ['feed'])).feed).toBe(true);
  });

  it('tames Bluesky', async () => {
    await tab.goto(urls.bluesky);
    const ids = ['keep', 'following', 'discover', 'trending', 'likes', 'reposts'];
    expect(await visibility(tab, ids)).toEqual({
      keep: true,
      following: false,
      discover: false,
      trending: false,
      likes: false,
      reposts: false,
      grayscale: true,
    });

    await pushPath('/profile/someone');
    expect(await visibility(tab, ['following', 'trending'])).toMatchObject({ following: true, trending: false });
  });

  it('removes the page path when the session ends', async () => {
    await tab.goto(urls.pinterest);
    expect(await tab.$eval('html', (html) => html.getAttribute('data-lock-in-path'))).toBe('/');

    await setStored(control, { activeSession: null });
    await expect.poll(() => tab.$eval('html', (html) => html.getAttribute('data-lock-in-path'))).toBeNull();
    expect((await visibility(tab, ['pin'])).pin).toBe(true);
  });
});
