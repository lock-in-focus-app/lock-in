import type { Profile } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, setStored, startSession, urls, visibility, wait, type TestBrowser } from './harness';

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

  /** Single-page apps change the path without loading a new page. */
  const pushPath = async (path: string) => {
    await tab.evaluate((p) => history.pushState({}, '', p), path);
    await wait(100);
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
    expect(await visibility(tab, ['timeline', 'explore-tabs'])).toMatchObject({ timeline: false, 'explore-tabs': false });

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

  it('removes the page path when the session ends', async () => {
    await tab.goto(urls.pinterest);
    expect(await tab.$eval('html', (html) => html.getAttribute('data-lock-in-path'))).toBe('/');

    await setStored(control, { activeSession: null });
    await wait(300);
    expect(await tab.$eval('html', (html) => html.getAttribute('data-lock-in-path'))).toBeNull();
    expect((await visibility(tab, ['pin'])).pin).toBe(true);
  });
});
