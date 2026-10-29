import { starterProfiles, type Profile } from '@lock-in/core';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, setStored, startSession, stored, type TestBrowser } from './harness';

// The element picker, opened from the popup on a site added by address and tamed: picking parts
// of the real page hides them whenever the profile tames the site.

const site = 'http://picker.test/';
const recipeId = 'site:picker.test';

describe('the element picker', () => {
  let t: TestBrowser;
  let control: Page;
  const profileId = starterProfiles[0]!.id;

  const hidden = async () =>
    (await stored(control)).profiles?.find((p) => p.id === profileId)?.sites.find((s) => s.recipeId === recipeId)
      ?.hidden ?? [];
  const shown = (tab: Page, selector: string) => tab.$eval(selector, (e) => getComputedStyle(e).display !== 'none');

  /** Opens the popup on the tab and starts the picker from it. */
  async function startPicking(tab: Page) {
    const earlier = new Set(t.browser.targets());
    await tab.bringToFront();
    await tab.triggerExtensionAction(t.extension);
    const target = await t.browser.waitForTarget((x) => x.url().endsWith('/popup.html') && !earlier.has(x));
    const popup = (await target.asPage())!;
    await popup.waitForSelector('main > .site .pick button');
    await popup.click('main > .site .pick button');
    await tab.waitForSelector('lock-in-picker >>> .panel', { visible: true });
  }

  beforeAll(async () => {
    t = await launch({ reach: ['*://*.picker.test/*'] });
    control = await controlPage(t);
    const list: Profile[] = starterProfiles.map((p) =>
      p.id === profileId ? { ...p, sites: [...p.sites, { recipeId, level: 'tamed' }] } : p,
    );
    await setStored(control, { profiles: list });
  });
  afterAll(() => t?.close());

  it('picks a part, widens it, and hides it straight away', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    await startPicking(tab);

    // Clicking a link picks it instead of following it.
    await tab.click('#away');
    expect(tab.url()).toBe(site);
    await tab.click('aside.trending h2');
    expect(await tab.$eval('lock-in-picker >>> .say', (e) => e.textContent)).toContain('Trending now');
    await tab.click('lock-in-picker >>> button.bigger');
    expect(await tab.$eval('lock-in-picker >>> .say', (e) => e.textContent)).toContain('Trending now');
    expect(await tab.$('lock-in-picker >>> .say ~ .note')).toBeNull();
    await tab.click('lock-in-picker >>> button.hide');

    await expect.poll(hidden).toEqual([{ selector: 'aside.trending', label: 'Trending now' }]);
    // Shown hidden while picking, even with no session running.
    await expect.poll(() => shown(tab, 'aside.trending')).toBe(false);
    expect(await tab.$eval('lock-in-picker >>> li span', (e) => e.textContent)).toBe('Trending now');

    await tab.click('lock-in-picker >>> button.done');
    expect(await tab.$('lock-in-picker')).toBeNull();
    expect(await shown(tab, 'aside.trending')).toBe(true);
    await tab.close();
  });

  it('points at one of several look-alikes by its place', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    await startPicking(tab);
    // Something as big as the page says so before it's hidden.
    await tab.click('main', { offset: { x: 5, y: 400 } });
    expect(await tab.$eval('lock-in-picker >>> .say ~ .note', (e) => e.textContent)).toContain(
      "That's most of the page",
    );
    await tab.click('#second');
    await tab.click('lock-in-picker >>> button.hide');
    await expect.poll(async () => (await hidden()).length).toBe(2);
    const part = (await hidden())[1]!;
    expect(part.label).toBe('Two');
    expect(part.selector).not.toContain('r-1awozwy');
    expect(await tab.$$eval(part.selector, (found) => found.map((e) => e.id))).toEqual(['second']);
    await tab.click('lock-in-picker >>> button.done');
    await tab.close();
  });

  it('hides the parts whenever a session tames the site', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    expect(await shown(tab, 'aside.trending')).toBe(true);
    await startSession(control, profileId);
    await expect.poll(() => shown(tab, 'aside.trending')).toBe(false);
    expect(await shown(tab, '#second')).toBe(false);
    expect(await shown(tab, '.card')).toBe(true);
    await setStored(control, { activeSession: null });
    await expect.poll(() => shown(tab, 'aside.trending')).toBe(true);
    await tab.close();
  });

  it("can't show a part again during a Hard session, but can after", async () => {
    await setStored(control, {
      activeSession: {
        id: 'hard',
        profileId,
        startedAt: Date.now(),
        timer: { minutes: 30, onEnd: 'silent', showSinceDone: false, strictness: 'hard' },
      },
    });
    const options = await t.browser.newPage();
    await options.goto(`chrome-extension://${t.extensionId}/options.html`);
    const showAgain = 'button[aria-label="Show Trending now again"]';
    await options.waitForSelector(showAgain);
    expect(await options.$eval(showAgain, (b) => (b as HTMLButtonElement).disabled)).toBe(true);

    await setStored(control, { activeSession: null });
    await options.waitForFunction((s) => !(document.querySelector(s) as HTMLButtonElement).disabled, {}, showAgain);
    await options.click(showAgain);
    await expect.poll(async () => (await hidden()).map((p) => p.label)).toEqual(['Two']);
    await options.close();
  });
});
