import type { Profile } from '@lock-in/core';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  controlPage,
  launch,
  redirectPage,
  setStored,
  startSession,
  stored,
  urls,
  visibility,
  wait,
  type TestBrowser,
} from './harness';

const pagesProfile: Profile = {
  id: 'pages',
  name: 'Pages',
  sites: [
    { recipeId: 'youtube', level: 'tamed', paths: [{ path: '/shorts', level: 'redirected' }] },
    {
      recipeId: 'reddit',
      level: 'redirected',
      paths: [
        { path: '/r/writing', level: 'allowed' },
        { path: '/r/writing/comments', level: 'restricted' },
      ],
    },
  ],
};

describe('page rules', () => {
  let t: TestBrowser;
  let control: Page;
  let tab: Page;
  const youtube = (path: string) => new URL(path, urls.youtube).href;
  const reddit = (path: string) => new URL(path, urls.reddit).href;

  /** Changes the page the way a single-page app does, then gives Seiza time to react. */
  const pushPath = async (path: string, expectRedirect: boolean) => {
    await tab.evaluate((p) => history.pushState({}, '', p), path);
    // Staying put can only be checked by waiting a moment.
    if (!expectRedirect) return wait(300);
    // The site's own pushState counts as a navigation too, so wait for the URL instead.
    await expect.poll(() => tab.url()).toMatch(/^chrome-extension:/);
    await tab.waitForSelector('main');
  };

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
    await setStored(control, { profiles: [pagesProfile] });
    await startSession(control, 'pages');
    tab = await t.browser.newPage();
  });
  afterAll(() => t?.close());

  describe('on page loads', () => {
    it('redirects a page inside a tamed site', async () => {
      await tab.goto(youtube('/shorts/abc'));
      expect(tab.url()).toBe(redirectPage(t, youtube('/shorts/abc')));
      expect(await tab.$eval('main', (main) => (main as HTMLElement).innerText)).toContain('Focus for 5 minutes first');
    });

    it('tames the rest of the site', async () => {
      await tab.goto(youtube('/'));
      expect(tab.url()).toBe(youtube('/'));
      await expect.poll(async () => (await visibility(tab, ['home'])).home).toBe(false);
    });

    it('opens an allowed page inside a redirected site, most specific rule first', async () => {
      await tab.goto(reddit('/r/writing/'));
      expect(tab.url()).toBe(reddit('/r/writing/'));
      await tab.goto(reddit('/r/all'));
      expect(tab.url()).toBe(redirectPage(t, reddit('/r/all')));
      await tab.goto(reddit('/r/writing/comments/1'));
      expect(tab.url()).toBe(redirectPage(t, reddit('/r/writing/comments/1')));
      await tab.waitForSelector('h1');
      expect(await tab.$eval('h1', (h1) => h1.textContent)).toBe('Reddit is off for now');
    });
  });

  describe('inside single-page apps', () => {
    it('redirects when the site moves onto a redirected page', async () => {
      await tab.goto(youtube('/watch?v=1'));
      await pushPath('/shorts/xyz', true);
      expect(tab.url()).toBe(redirectPage(t, youtube('/shorts/xyz')));
    });

    it('lets Back return to the page before', async () => {
      await tab.goBack();
      expect(tab.url()).toBe(youtube('/watch?v=1'));
    });

    it('follows the same rules as page loads', async () => {
      await tab.goto(reddit('/r/writing'));
      await pushPath('/r/writing/about', false);
      expect(tab.url()).toBe(reddit('/r/writing/about'));
      await pushPath('/r/popular', true);
      expect(tab.url()).toBe(redirectPage(t, reddit('/r/popular')));
    });

    it('lets a pass through', async () => {
      const session = (await stored(control)).activeSession;
      await setStored(control, { activeSession: { ...session, passes: { youtube: Date.now() + 60_000 } } });
      await tab.goto(youtube('/watch?v=1'));
      await pushPath('/shorts/xyz', false);
      expect(tab.url()).toBe(youtube('/shorts/xyz'));
    });

    it('does nothing once the session ends', async () => {
      await setStored(control, { activeSession: null });
      await tab.goto(reddit('/r/writing'));
      await pushPath('/r/all', false);
      expect(tab.url()).toBe(reddit('/r/all'));
    });
  });
});

describe('page rules in settings', () => {
  let t: TestBrowser;
  let page: Page;

  const youtubeRow = 'li:has([aria-label="YouTube level"])';
  const redditRow = 'li:has([aria-label="Reddit level"])';
  const xRow = 'li:has([aria-label="X level"])';
  const buttonsIn = (row: string) =>
    page.$$eval(`${row} button`, (buttons) => buttons.map((b) => b.textContent!.trim()));
  const writing = async (recipeId: string) =>
    ((await stored(page)).profiles as Profile[])
      .find((p) => p.id === 'writing')!
      .sites.find((s) => s.recipeId === recipeId);
  const buttonIn = (row: string, label: string) =>
    page.$$eval(
      `${row} button`,
      (buttons, wanted) => (buttons.find((b) => b.textContent!.trim() === wanted) as HTMLElement).click(),
      label,
    );

  beforeAll(async () => {
    t = await launch();
    page = await t.browser.newPage();
    await page.setViewport({ width: 900, height: 1400 });
    await page.goto(`chrome-extension://${t.extensionId}/options.html`);
    await page.waitForSelector('[role=tab]');
  });
  afterAll(() => t?.close());

  it("shows a site's page rules with their levels", async () => {
    expect(await page.$eval(`${youtubeRow} .rules code`, (code) => code.textContent)).toBe('/shorts');
    expect(
      await page.$eval('[aria-label="YouTube /shorts level"] [aria-checked=true]', (b) => b.textContent!.trim()),
    ).toBe('Redirected');
  });

  it('adds suggested pages in one click', async () => {
    await buttonIn(redditRow, '+ Redirect r/all & Popular');
    await expect
      .poll(async () => (await writing('reddit'))?.paths)
      .toEqual([
        { path: '/r/all', level: 'redirected' },
        { path: '/r/popular', level: 'redirected' },
      ]);
    await expect.poll(() => buttonsIn(redditRow)).not.toContain('+ Redirect r/all & Popular');
  });

  it('only suggests redirecting pages of sites that are open', async () => {
    expect(await buttonsIn(xRow)).not.toContain('+ Redirect Explore');
    expect(await buttonsIn(xRow)).toContain('+ Page rule');
  });

  it('starts typed pages on a redirected site as allowed', async () => {
    await buttonIn(xRow, '+ Page rule');
    await page.type(`${xRow} input`, '/i/bookmarks');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await writing('x'))?.paths).toEqual([{ path: '/i/bookmarks', level: 'allowed' }]);
  });

  it('adds a typed page, rejecting ones that are not plain paths', async () => {
    await buttonIn(youtubeRow, '+ Page rule');
    await page.type(`${youtubeRow} input`, '/results?search_query=cats');
    expect(await page.$eval(`${youtubeRow} .error`, (p) => p.textContent)).toContain('Use a path like');
    expect(await page.$eval(`${youtubeRow} button[type=submit]`, (b) => b.disabled)).toBe(true);

    await page.click(`${youtubeRow} input`, { count: 3 });
    await page.type(`${youtubeRow} input`, 'https://www.youtube.com/feed/trending/');
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await writing('youtube'))?.paths)
      .toEqual([
        { path: '/shorts', level: 'redirected' },
        { path: '/feed/trending', level: 'redirected' },
      ]);
  });

  it('changes and removes page rules', async () => {
    await page.$eval('[aria-label="YouTube /feed/trending level"]', (group) =>
      (
        [...group.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Restricted') as HTMLElement
      ).click(),
    );
    await expect
      .poll(async () => (await writing('youtube'))?.paths?.[1])
      .toEqual({ path: '/feed/trending', level: 'restricted' });

    await page.click('[aria-label="Remove /feed/trending"]');
    await expect
      .poll(async () => (await writing('youtube'))?.paths)
      .toEqual([{ path: '/shorts', level: 'redirected' }]);
  });
});
