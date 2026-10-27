import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  controlPage,
  launch,
  redirectPage,
  setProfileRedirect,
  setStored,
  startSession,
  stored,
  urls,
  wait,
  type TestBrowser,
} from './harness';

const overlayText = (page: Page) =>
  page.evaluate(() => document.querySelector('lock-in-pause')?.shadowRoot?.textContent ?? null);

const overlayButton = (wanted: string) =>
  [...(document.querySelector('lock-in-pause')?.shadowRoot?.querySelectorAll('button') ?? [])].find(
    (b) => b.textContent === wanted,
  );

// The cover goes up once a pass runs out, which can take a moment on a slow CI runner, so
// this waits for the button before clicking it.
const clickOverlay = async (page: Page, label: string) => {
  await page.waitForFunction(`(${overlayButton})(${JSON.stringify(label)}) !== undefined`);
  await page.evaluate(`(${overlayButton})(${JSON.stringify(label)}).click()`);
};

describe('open tabs and expired passes', () => {
  let t: TestBrowser;
  let control: Page;

  /** Gives Deep Work a pass to Reddit that runs out shortly. */
  async function passEndingSoon() {
    const { activeSession } = await stored(control);
    await setStored(control, { activeSession: { ...activeSession, passes: { reddit: Date.now() + 1500 } } });
    await wait(300);
  }

  async function endSession() {
    await setStored(control, { activeSession: null });
    await wait(300);
  }

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
  });
  afterAll(() => t?.close());

  describe('pause (the default)', () => {
    let tab: Page;

    beforeAll(async () => {
      tab = await t.browser.newPage();
      await tab.goto(urls.reddit);
      await startSession(control, 'deep-work');
    });

    it('covers tabs that were open before the session', async () => {
      expect(await overlayText(tab)).toContain('Reddit is paused for now');
    });

    it('removes the cover while a pass is running, and brings it back when it ends', async () => {
      await passEndingSoon();
      expect(await overlayText(tab)).toBeNull();
      await tab.bringToFront();
      await expect.poll(() => overlayText(tab), { timeout: 10_000 }).toContain('Your pass for Reddit ran out');
    });

    it('goes to the redirect page from "Still need it"', async () => {
      await Promise.all([tab.waitForNavigation(), clickOverlay(tab, 'Still need it')]);
      expect(tab.url()).toBe(redirectPage(t, urls.reddit));
    });

    it('closes the tab from "Close tab"', async () => {
      await tab.goto(urls.other);
      await passEndingSoon();
      await tab.goto(urls.reddit);
      await tab.bringToFront();
      const closed = new Promise((resolve) => tab.once('close', resolve));
      await clickOverlay(tab, 'Close tab');
      await closed;
      expect(tab.isClosed()).toBe(true);
    });

    it('removes the cover when the session ends', async () => {
      await endSession();
      const page = await t.browser.newPage();
      await page.goto(urls.reddit);
      await startSession(control, 'deep-work');
      // The cover can take a moment on a slow CI runner, both ways.
      await expect.poll(() => overlayText(page), { timeout: 10_000 }).not.toBeNull();
      await setStored(control, { activeSession: null });
      await expect.poll(() => overlayText(page), { timeout: 10_000 }).toBeNull();
      await page.close();
    });
  });

  describe('send it back', () => {
    beforeAll(async () => {
      await endSession();
      await setProfileRedirect(control, 'deep-work', { destinations: ['gate'], gate: { onPassExpiry: 'redirect' } });
    });

    it('sends the tab back when its pass ends', async () => {
      const tab = await t.browser.newPage();
      await startSession(control, 'deep-work');
      await passEndingSoon();
      await tab.goto(urls.reddit);
      expect(tab.url()).toBe(urls.reddit);

      await tab.bringToFront();
      await tab.waitForNavigation({ timeout: 5000 });
      expect(tab.url()).toBe(redirectPage(t, urls.reddit, true));
      await tab.waitForSelector('.badge');
      expect(await tab.$eval('.badge', (el) => el.textContent)).toBe('Your pass for Reddit ran out');
      await tab.close();
    });
  });

  describe('leave it open', () => {
    beforeAll(async () => {
      await endSession();
      await setProfileRedirect(control, 'deep-work', { gate: { onPassExpiry: 'nothing' } });
    });

    it('leaves open tabs alone', async () => {
      const tab = await t.browser.newPage();
      await tab.goto(urls.reddit);
      await startSession(control, 'deep-work');
      expect(await overlayText(tab)).toBeNull();
      expect(tab.url()).toBe(urls.reddit);
      await tab.close();
    });
  });
});
