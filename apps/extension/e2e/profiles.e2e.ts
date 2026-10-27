import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, openPopup, startSession, stored, text, urls, wait, type TestBrowser } from './harness';

describe('profile editor', () => {
  let t: TestBrowser;
  let page: Page;

  const tabs = () => page.$$eval('[role=tab]', (els) => els.map((el) => el.textContent!.trim()));
  const selectTab = (name: string) =>
    page.$$eval(
      '[role=tab]',
      (els, wanted) => (els.find((el) => el.textContent!.trim() === wanted) as HTMLElement).click(),
      name,
    );
  // Some buttons only show up once an earlier click has been saved, so this waits for them.
  const clickButton = async (label: string) => {
    const find = (wanted: string) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent!.trim() === wanted);
    await page.waitForFunction(`(${find})(${JSON.stringify(label)}) !== undefined`);
    await page.evaluate(`(${find})(${JSON.stringify(label)}).click()`);
  };
  const buttonDisabled = (label: string) =>
    page.$$eval(
      'button',
      (buttons, wanted) => (buttons.find((b) => b.textContent!.trim() === wanted) as HTMLButtonElement).disabled,
      label,
    );
  const setLevel = (site: string, level: string) =>
    page.$eval(
      `[role=radiogroup][aria-label="${site} level"]`,
      (group, wanted) => {
        ([...group.querySelectorAll('button')].find((b) => b.textContent!.trim() === wanted) as HTMLElement).click();
      },
      level,
    );
  const levelOf = (site: string) =>
    page.$eval(`[role=radiogroup][aria-label="${site} level"] [aria-checked=true]`, (b) => b.textContent!.trim());
  const savedProfiles = async () =>
    (await stored(page)).profiles as {
      id: string;
      name: string;
      sites: { recipeId: string; level: string; toggles?: Record<string, boolean> }[];
    }[];
  const rename = async (name: string) => {
    await page.click('input[aria-label="Profile name"]', { count: 3 });
    await page.type('input[aria-label="Profile name"]', name);
    await page.keyboard.press('Enter');
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

  it('lists every built-in site, with sites a profile leaves out allowed', async () => {
    expect(await levelOf('YouTube')).toBe('Tamed');
    expect(await levelOf('Instagram')).toBe('Redirected');
    expect(await levelOf('Pinterest')).toBe('Allowed');
  });

  it('changes site levels, keeping toggles for later', async () => {
    await setLevel('Reddit', 'Restricted');
    await expect
      .poll(async () => (await savedProfiles())[0]!.sites[0])
      .toEqual({
        recipeId: 'reddit',
        level: 'restricted',
        toggles: { grayscale: true },
      });
    await expect.poll(() => page.$('li:has([aria-label="Reddit level"]) .toggles')).toBeNull();

    await setLevel('Reddit', 'Tamed');
    await expect
      .poll(() => page.$$eval('li:has([aria-label="Reddit level"]) .toggles [role=switch]', (els) => els.length))
      .toBe(5);
  });

  it('creates a profile and selects its name for editing', async () => {
    await clickButton('+ New profile');
    await expect.poll(tabs).toEqual(['Writing', 'Deep Work', 'Wind Down', 'New profile']);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Profile name');
    expect(await levelOf('Reddit')).toBe('Allowed');
  });

  it('renames a profile, ignoring blank names', async () => {
    await rename('Reading');
    await expect.poll(async () => (await savedProfiles()).at(-1)!.name).toBe('Reading');
    await rename('   ');
    // Nothing should be saved, so all there is to wait for is a moment.
    await wait(300);
    expect((await savedProfiles()).at(-1)!.name).toBe('Reading');
    expect(await page.$eval('input[aria-label="Profile name"]', (input) => input.value)).toBe('Reading');
  });

  it('duplicates and reorders profiles', async () => {
    await clickButton('Duplicate');
    await expect.poll(tabs).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading', 'Reading copy']);
    await clickButton('Move earlier');
    await expect.poll(tabs).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading copy', 'Reading']);
    expect(await buttonDisabled('Move later')).toBe(false);
  });

  it('asks before deleting', async () => {
    await clickButton('Delete');
    expect(await page.$eval('.confirm', (el) => el.textContent)).toContain('Delete Reading copy?');
    await clickButton('Cancel');
    expect(await tabs()).toHaveLength(5);

    await clickButton('Delete');
    await page.click('.confirm-delete');
    await expect.poll(tabs).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading']);
  });

  it("won't delete the profile that's running", async () => {
    const control = await controlPage(t);
    await startSession(control, 'deep-work');
    await page.bringToFront();
    await selectTab('Deep Work');
    await expect
      .poll(() => page.$eval('main', (m) => (m as HTMLElement).innerText))
      .toContain('Deep Work is running now');
    expect(await buttonDisabled('Delete')).toBe(true);
    await control.evaluate(() =>
      (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.set({ activeSession: null }),
    );
    await control.close();
  });

  it('resets the starter profiles and keeps your own', async () => {
    await selectTab('Writing');
    await rename('Scribbling');
    await clickButton('Reset starter profiles');
    await page.click('.confirm-reset');
    await expect.poll(tabs).toEqual(['Writing', 'Deep Work', 'Wind Down', 'Reading']);
    expect((await savedProfiles())[0]!.sites[0]).toEqual({
      recipeId: 'reddit',
      level: 'tamed',
      toggles: { grayscale: true },
    });
  });

  it('changes levels from the popup between sessions', async () => {
    const reddit = await t.browser.newPage();
    await reddit.goto(urls.reddit);
    const popup = await openPopup(t, reddit);
    await popup.$eval('[role=radiogroup][aria-label="Reddit level"]', (group) =>
      (
        [...group.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Redirected') as HTMLElement
      ).click(),
    );
    await expect.poll(async () => (await savedProfiles())[0]!.sites[0]!.level).toBe('redirected');
    await expect.poll(() => text(popup)).toContain('Applies whenever Writing is running');
    expect(await popup.$$eval('[role=switch]', (els) => els.length)).toBe(0);
  });
});

describe('managing profiles', () => {
  let t: TestBrowser;
  let page: Page;
  let control: Page;

  // Some buttons only show up once an earlier click has been saved, so this waits for them.
  const clickButton = async (label: string) => {
    const find = (wanted: string) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent!.trim() === wanted);
    await page.waitForFunction(`(${find})(${JSON.stringify(label)}) !== undefined`);
    await page.evaluate(`(${find})(${JSON.stringify(label)}).click()`);
  };
  const button = (prefix: string) =>
    page.$$eval(
      'button',
      (buttons, wanted) => {
        const found = buttons.find((b) => b.textContent!.trim().startsWith(wanted)) as HTMLButtonElement;
        return { label: found.textContent!.trim(), disabled: found.disabled };
      },
      prefix,
    );
  const names = async () => ((await stored(control)).profiles ?? []).map((p) => p.name);

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
    page = await t.browser.newPage();
    await page.setViewport({ width: 900, height: 1200 });
    await page.goto(`chrome-extension://${t.extensionId}/options.html`);
    await page.waitForSelector('[role=tab]');
  });
  afterAll(() => t?.close());

  it('keeps at least one profile', async () => {
    await clickButton('Manage');
    await clickButton('Select all');
    await expect.poll(() => button('Delete')).toEqual({ label: 'Delete 3', disabled: true });
    expect(await page.$eval('main', (main) => main.textContent)).toContain('At least one profile has to stay');
    await clickButton('Clear');
  });

  it('deletes several at once, but not the running one', async () => {
    await startSession(control, 'writing');
    await expect
      .poll(() => page.$eval('input[aria-label="Select Writing"]', (input) => (input as HTMLInputElement).disabled))
      .toBe(true);

    await clickButton('Select all');
    await expect.poll(() => button('Delete')).toEqual({ label: 'Delete 2', disabled: false });
    await clickButton('Delete 2');
    expect(await (await page.waitForSelector('[role=alert]'))!.evaluate((el) => el.textContent)).toContain(
      "Delete 2 profiles? This can't be undone.",
    );
    await page.click('.confirm-delete');
    await expect.poll(names).toEqual(['Writing']);
  });

  it('goes back to editing when done', async () => {
    await clickButton('Done');
    await expect
      .poll(() => page.$$eval('[role=tab]', (tabs) => tabs.map((tab) => tab.textContent!.trim())))
      .toEqual(['Writing']);
    expect(await page.$('input[aria-label="Profile name"]')).not.toBeNull();
  });
});
