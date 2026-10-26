import { starterProfiles, type Profile } from '@lock-in/core';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, redirectPage, setStored, startSession, stored, urls, wait, type TestBrowser } from './harness';

describe('restricted sites', () => {
  let t: TestBrowser;
  let control: Page;
  let tab: Page;

  const pageText = () => tab.$eval('main', (main) => (main as HTMLElement).innerText);

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
    const list: Profile[] = (await stored(control)).profiles ?? starterProfiles;
    await setStored(control, {
      profiles: list.map((p) =>
        p.id === 'deep-work' ? { ...p, sites: p.sites.map((s) => (s.recipeId === 'reddit' ? { ...s, level: 'restricted' } : s)) } : p,
      ),
    });
    tab = await t.browser.newPage();
    await tab.goto(urls.reddit);
    await startSession(control, 'deep-work');
  });
  afterAll(() => t?.close());

  it('covers open tabs with no way through', async () => {
    const overlay = await tab.evaluate(() => {
      const root = document.querySelector('lock-in-pause')?.shadowRoot;
      return { text: root?.textContent, buttons: [...(root?.querySelectorAll('button') ?? [])].map((b) => b.textContent) };
    });
    expect(overlay.text).toContain('Reddit is off for now');
    expect(overlay.buttons).toEqual(['Close tab']);
  });

  it('sends visits to a page with no Continue', async () => {
    await tab.goto(urls.reddit);
    await tab.waitForSelector('.badge');
    expect(tab.url()).toBe(redirectPage(t, urls.reddit));
    const text = await pageText();
    expect(text).toContain('Reddit is off for now');
    expect(text).toContain('First try at Reddit today');
    expect(text).not.toContain('Still need Reddit?');
    expect(await tab.$('button.continue')).toBeNull();
    expect((await stored(control)).gateVisits.at(-1)).toMatchObject({ recipeId: 'reddit', destination: 'blocked' });
  });

  it('ignores passes', async () => {
    const { activeSession } = await stored(control);
    await setStored(control, { activeSession: { ...activeSession, passes: { reddit: Date.now() + 60_000 } } });
    await wait(300);
    await tab.goto(urls.reddit);
    expect(tab.url()).toBe(redirectPage(t, urls.reddit));
  });

  it('still lets redirected sites through the gate', async () => {
    await tab.goto(urls.x);
    await tab.waitForSelector('.badge');
    expect(await pageText()).not.toContain('is off for now');
  });

  it('opens up when the session ends', async () => {
    await setStored(control, { activeSession: null });
    await wait(300);
    await tab.goto(urls.reddit);
    expect(tab.url()).toBe(urls.reddit);
  });
});
