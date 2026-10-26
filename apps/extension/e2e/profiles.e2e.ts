import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, openPopup, startSession, stored, text, urls, wait, type TestBrowser } from './harness';

describe('profile editor', () => {
  let t: TestBrowser;
  let page: Page;

  const tabs = () => page.$$eval('[role=tab]', (els) => els.map((el) => el.textContent!.trim()));
  const selectTab = (name: string) =>
    page.$$eval('[role=tab]', (els, wanted) => (els.find((el) => el.textContent!.trim() === wanted) as HTMLElement).click(), name);
  const clickButton = (label: string) =>
    page.$$eval(
      'button',
      (buttons, wanted) => (buttons.find((b) => b.textContent!.trim() === wanted) as HTMLElement).click(),
      label,
    );
  const buttonDisabled = (label: string) =>
    page.$$eval('button', (buttons, wanted) => (buttons.find((b) => b.textContent!.trim() === wanted) as HTMLButtonElement).disabled, label);
  const setLevel = (site: string, level: string) =>
    page.$eval(`[role=radiogroup][aria-label="${site} level"]`, (group, wanted) => {
      ([...group.querySelectorAll('button')].find((b) => b.textContent!.trim() === wanted) as HTMLElement).click();
    }, level);
  const levelOf = (site: string) =>
    page.$eval(`[role=radiogroup][aria-label="${site} level"] [aria-checked=true]`, (b) => b.textContent!.trim());
  const savedProfiles = async () => (await stored(page)).profiles as { id: string; name: string; sites: { recipeId: string; level: string; toggles?: Record<string, boolean> }[] }[];
  const rename = async (name: string) => {
    await page.click('input[aria-label="Profile name"]', { count: 3 });
    await page.type('input[aria-label="Profile name"]', name);
    await page.keyboard.press('Enter');
    await wait(150);
  };

  beforeAll(async () => {
    t = await launch();
    page = await t.browser.newPage();
    await page.setViewport({ width: 900, height: 1200 });
    await page.goto(`chrome-extension://${t.extensionId}/options.html`);
    await page.waitForSelector('[role=tab]');
  });
  afterAll(() => t?.close());

  it("shows each site's level for the selected profile", async () => {
    expect(await tabs()).toEqual(['Writing', 'Deep Work', 'Wind Down']);
    expect(await levelOf('Reddit')).toBe('Tamed');
    expect(await levelOf('X')).toBe('Redirected');
  });

  it("can't tame a site that has nothing to hide yet", async () => {
    const disabled = await page.$eval('[role=radiogroup][aria-label="X level"]', (group) =>
      [...group.querySelectorAll('button')].filter((b) => b.disabled).map((b) => b.textContent!.trim()),
    );
    expect(disabled).toEqual(['Tamed']);
  });

  it('changes site levels, keeping toggles for later', async () => {
    await setLevel('Reddit', 'Restricted');
    await wait(150);
    expect((await savedProfiles())[0]!.sites[0]).toEqual({ recipeId: 'reddit', level: 'restricted', toggles: { grayscale: true } });
    expect(await page.$('.toggles')).toBeNull();

    await setLevel('Reddit', 'Tamed');
    await wait(150);
    expect(await page.$$eval('.toggles [role=switch]', (els) => els.length)).toBe(5);
  });

  it('creates a profile and selects its name for editing', async () => {
    await clickButton('+ New profile');
    await wait(200);
    expect(await tabs()).toEqual(['Writing', 'Deep Work', 'Wind Down', 'New profile']);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Profile name');
    expect(await levelOf('Reddit')).toBe('Allowed');
  });

  it('renames a profile, ignoring blank names', async () => {
    await rename('Reading');
    expect((await savedProfiles()).at(-1)!.name).toBe('Reading');
    await rename('   ');
    expect((await savedProfiles()).at(-1)!.name).toBe('Reading');
    expect(await page.$eval('input[aria-label="Profile name"]', (input) => input.value)).toBe('Reading');
  });

  it('duplicates and reorders profiles', async () => {
    await clickButton('Duplicate');
    await wait(200);
    expect(await tabs()).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading', 'Reading copy']);
    await clickButton('Move earlier');
    await wait(150);
    expect(await tabs()).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading copy', 'Reading']);
    expect(await buttonDisabled('Move later')).toBe(false);
  });

  it('asks before deleting', async () => {
    await clickButton('Delete');
    expect(await page.$eval('.confirm', (el) => el.textContent)).toContain('Delete Reading copy?');
    await clickButton('Cancel');
    expect(await tabs()).toHaveLength(5);

    await clickButton('Delete');
    await page.click('.confirm-delete');
    await wait(150);
    expect(await tabs()).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading']);
  });

  it("won't delete the profile that's running", async () => {
    const control = await controlPage(t);
    await startSession(control, 'deep-work');
    await page.bringToFront();
    await selectTab('Deep Work');
    await wait(150);
    expect(await buttonDisabled('Delete')).toBe(true);
    expect(await page.$eval('main', (m) => (m as HTMLElement).innerText)).toContain('Deep Work is running now');
    await control.evaluate(() => (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.set({ activeSession: null }));
    await control.close();
  });

  it('resets the starter profiles and keeps your own', async () => {
    await selectTab('Writing');
    await rename('Scribbling');
    await clickButton('Reset starter profiles');
    await page.click('.confirm-reset');
    await wait(200);
    expect(await tabs()).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading']);
    expect((await savedProfiles())[0]!.sites[0]).toEqual({ recipeId: 'reddit', level: 'tamed', toggles: { grayscale: true } });
  });

  it('changes levels from the popup between sessions', async () => {
    const reddit = await t.browser.newPage();
    await reddit.goto(urls.reddit);
    const popup = await openPopup(t, reddit);
    await popup.$eval('[role=radiogroup][aria-label="Reddit level"]', (group) =>
      ([...group.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Redirected') as HTMLElement).click(),
    );
    await wait(150);
    expect((await savedProfiles())[0]!.sites[0]!.level).toBe('redirected');
    expect(await text(popup)).toContain('Applies whenever Writing is running');
    expect(await popup.$$eval('[role=switch]', (els) => els.length)).toBe(0);
  });
});
