import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launch, openPopup, urls, visibility, type TestBrowser } from './harness';

// One browser for the whole file; each test picks up where the last one left off.
describe('sessions', () => {
  let t: TestBrowser;
  let reddit: Page;
  let popup: Page;
  const page = () => visibility(reddit, ['feed', 'suggested', 'ad', 'keep']);

  beforeAll(async () => {
    t = await launch();
    reddit = await t.browser.newPage();
    await reddit.goto(urls.reddit);
  });
  afterAll(() => t?.close());

  it('leaves sites alone without a session', async () => {
    expect(await page()).toEqual({ feed: true, suggested: true, ad: true, keep: true, grayscale: false });
  });

  it('lists the starter profiles', async () => {
    popup = await openPopup(t, reddit);
    const names = await popup.$$eval('button.profile .name', (els) => els.map((el) => el.textContent));
    expect(names).toEqual(['Writing', 'Deep Work', 'Wind Down']);
  });

  it('tames tabs that are already open when a session starts', async () => {
    await popup.click('button.profile');
    await popup.waitForSelector('.elapsed');
    await expect.poll(page).toEqual({ feed: false, suggested: false, ad: false, keep: true, grayscale: true });
  });

  it('tames pages loaded during the session from the start', async () => {
    const fresh = await t.browser.newPage();
    await fresh.goto(urls.reddit);
    // Lock In reads the session from storage as the page starts, which can come back after a
    // page this small has already loaded.
    await expect.poll(async () => (await visibility(fresh, ['feed'])).feed).toBe(false);
    await fresh.close();
  });

  it('restores everything when the session ends', async () => {
    // Opening another tab closed the popup, just like it would for a user.
    popup = await openPopup(t, reddit);
    await popup.click('button.end');
    await popup.waitForSelector('button.profile');
    await expect.poll(page).toEqual({ feed: true, suggested: true, ad: true, keep: true, grayscale: false });
  });

  it("uses each profile's own toggles", async () => {
    const [, , windDown] = await popup.$$('button.profile');
    await windDown!.click();
    await expect.poll(page).toMatchObject({ feed: false, grayscale: false });
  });
});
