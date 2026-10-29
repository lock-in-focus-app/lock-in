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

  it('hides each click straight away, and saves them on Done', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    await startPicking(tab);

    // Clicking a link hides it instead of following it, and Undo brings it back.
    await tab.click('#away');
    expect(tab.url()).toBe(site);
    await expect.poll(() => shown(tab, '#away')).toBe(false);
    await tab.click('lock-in-picker >>> button[aria-label="Undo hiding Elsewhere"]');
    await expect.poll(() => shown(tab, '#away')).toBe(true);

    // A heading, then the bigger part around it, which takes its place.
    await tab.click('aside.trending h2');
    await expect.poll(() => shown(tab, 'aside.trending h2')).toBe(false);
    expect(await shown(tab, 'aside.trending')).toBe(true);
    await tab.click('lock-in-picker >>> button.bigger');
    await expect.poll(() => shown(tab, 'aside.trending')).toBe(false);
    expect(await tab.$$eval('lock-in-picker >>> li > span:first-child', (e) => e.map((x) => x.textContent))).toEqual([
      'Trending now',
    ]);

    // Nothing is saved until Done.
    expect(await hidden()).toEqual([]);
    await tab.click('lock-in-picker >>> button.done');
    await expect.poll(hidden).toEqual([{ selector: 'aside.trending', label: 'Trending now' }]);
    expect(await tab.$('lock-in-picker')).toBeNull();
    // With no session running, the page goes back to how it was.
    expect(await shown(tab, 'aside.trending')).toBe(true);
    await tab.close();
  });

  it('picks several things in one go, and Cancel keeps none of them', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    await startPicking(tab);
    await tab.click('#second');
    await tab.click('#away');
    await tab.click('#search');
    await expect.poll(() => shown(tab, '#second')).toBe(false);
    await expect.poll(() => shown(tab, '#away')).toBe(false);
    await expect.poll(() => shown(tab, '#search')).toBe(false);
    // Named by the words inside it, even inside its own shadow root.
    expect(
      await tab.$$eval('lock-in-picker >>> .list:first-of-type li > span:first-child', (e) =>
        e.map((x) => x.textContent),
      ),
    ).toEqual(['Two', 'Elsewhere', 'Search the site']);
    await tab.click('lock-in-picker >>> button.cancel');
    expect(await tab.$('lock-in-picker')).toBeNull();
    expect(await shown(tab, '#second')).toBe(true);
    expect(await hidden()).toHaveLength(1);
    await tab.close();
  });

  it('points at one of several look-alikes by its place, and says when a part is most of the page', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    await startPicking(tab);
    await tab.click('main', { offset: { x: 5, y: 400 } });
    const note = await tab.waitForSelector('lock-in-picker >>> li.note');
    expect(await note!.evaluate((e) => e.textContent)).toContain("That's most of the page");
    await tab.click('lock-in-picker >>> button.undo');
    await expect.poll(() => shown(tab, 'main')).toBe(true);

    await tab.click('#second');
    await tab.waitForSelector('lock-in-picker >>> button[aria-label="Undo hiding Two"]');
    await tab.click('lock-in-picker >>> button.done');
    await expect.poll(async () => (await hidden()).length).toBe(2);
    const part = (await hidden())[1]!;
    expect(part.label).toBe('Two');
    expect(part.selector).not.toContain('r-1awozwy');
    expect(await tab.$$eval(part.selector, (found) => found.map((e) => e.id))).toEqual(['second']);
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

  it("can't show a part again during a Hard session", async () => {
    await setStored(control, {
      activeSession: {
        id: 'hard',
        profileId,
        startedAt: Date.now(),
        timer: { minutes: 30, onEnd: 'silent', showSinceDone: false, strictness: 'hard' },
      },
    });
    const showAgain = 'button[aria-label="Show Trending now again"]';
    const options = await t.browser.newPage();
    await options.goto(`chrome-extension://${t.extensionId}/options.html`);
    await options.waitForSelector(showAgain);
    expect(await options.$eval(showAgain, (b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await options.close();

    const tab = await t.browser.newPage();
    await tab.goto(site);
    await startPicking(tab);
    expect(await tab.$eval(`lock-in-picker >>> ${showAgain}`, (b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await tab.click('lock-in-picker >>> button.cancel');
    await setStored(control, { activeSession: null });
    await tab.close();
  });

  it('shows a part again from the picker, saved on Done', async () => {
    await startSession(control, profileId);
    const tab = await t.browser.newPage();
    await tab.goto(site);
    await expect.poll(() => shown(tab, 'aside.trending')).toBe(false);
    await startPicking(tab);
    await tab.click('lock-in-picker >>> button[aria-label="Show Trending now again"]');
    // Shown on the page before it's saved.
    await expect.poll(() => shown(tab, 'aside.trending')).toBe(true);
    expect(await hidden()).toHaveLength(2);
    await tab.click('lock-in-picker >>> button.done');
    await expect.poll(async () => (await hidden()).map((p) => p.label)).toEqual(['Two']);
    expect(await shown(tab, 'aside.trending')).toBe(true);
    expect(await shown(tab, '#second')).toBe(false);
    await setStored(control, { activeSession: null });
    await tab.close();
  });

  it('keeps a site tamed outside sessions', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(site);
    expect(await shown(tab, '#second')).toBe(true);

    const earlier = new Set(t.browser.targets());
    await tab.bringToFront();
    await tab.triggerExtensionAction(t.extension);
    const target = await t.browser.waitForTarget((x) => x.url().endsWith('/popup.html') && !earlier.has(x));
    const popup = (await target.asPage())!;
    await popup.waitForSelector('main > .site button.outside');
    await popup.click('main > .site button.outside');

    await expect.poll(() => shown(tab, '#second')).toBe(false);
    const rule = async (id: string) =>
      (await stored(control)).profiles?.find((p) => p.id === id)?.sites.find((s) => s.recipeId === recipeId);
    expect(await rule(profileId)).toMatchObject({ outsideSessions: true });

    // Settings says so, and turns it off again.
    const options = await t.browser.newPage();
    await options.goto(`chrome-extension://${t.extensionId}/options.html`);
    await options.waitForFunction(() => document.body.innerText.includes('tamed like this with no session running'));
    await options.click('::-p-text(Keep picker.test tamed outside sessions)');
    await expect.poll(async () => (await rule(profileId))?.outsideSessions).toBeUndefined();
    await expect.poll(() => shown(tab, '#second')).toBe(true);
    await options.close();
    await tab.close();
  });
});
