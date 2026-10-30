import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, openPopup, setStored, stored, text, urls, type TestBrowser } from './harness';

const clickButton = (page: Page, label: string) =>
  page.$$eval(
    'button',
    (buttons, wanted) => (buttons.find((b) => b.textContent!.trim() === wanted) as HTMLElement).click(),
    label,
  );
const tourTitle = (page: Page) => page.$eval('.tour h2', (h2) => h2.textContent);

// One browser for the whole file; each test picks up where the last left off.
describe('the tour for new users', () => {
  let t: TestBrowser;
  let control: Page;
  let tab: Page;

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
    tab = await t.browser.newPage();
    await tab.goto(urls.other);
  });
  afterAll(() => t?.close());

  it('is offered in the popup until it is turned down', async () => {
    const popup = await openPopup(t, tab);
    await popup.waitForSelector('.offer');
    expect(await text(popup)).toContain('New here?');

    await clickButton(popup, 'No thanks');
    await expect.poll(async () => (await stored(control)).tourOffered).toBe(true);
    await expect.poll(() => popup.$('.offer')).toBeNull();
    await popup.close();

    const again = await openPopup(t, tab);
    expect(await again.$('.offer')).toBeNull();
    await again.close();
  });

  it('opens the settings page and steps through it', async () => {
    await setStored(control, { tourOffered: false });
    const popup = await openPopup(t, tab);
    await popup.waitForSelector('.offer');
    const opened = t.browser.waitForTarget((target) => target.url().includes('/options.html'));
    await clickButton(popup, 'Take the tour');
    const page = (await (await opened).asPage())!;
    await page.waitForSelector('.tour');
    expect((await stored(control)).tourOffered).toBe(true);
    // The #tour that started it is cleared, so reloading the page doesn't start it again.
    expect(new URL(page.url()).hash).toBe('');

    const titles = [await tourTitle(page)];
    for (let step = 1; step < 4; step++) {
      await clickButton(page, 'Next ›');
      await expect.poll(() => tourTitle(page)).not.toBe(titles[titles.length - 1]);
      titles.push(await tourTitle(page));
    }
    expect(titles).toEqual(['Profiles', 'Sites', 'The redirect page', 'The Seiza app']);
    expect(await page.$$eval('.tour button', (buttons) => buttons.map((b) => b.textContent!.trim()))).toEqual([
      '‹ Back',
      'Done',
    ]);

    await clickButton(page, 'Done');
    await expect.poll(() => page.$('.tour')).toBeNull();
  });

  it('can be taken again from the settings page, and skipped', async () => {
    const page = await t.browser.newPage();
    await page.goto(`chrome-extension://${t.extensionId}/options.html`);
    await page.waitForSelector('[role=tab]');
    expect(await page.$('.tour')).toBeNull();

    await clickButton(page, 'Take the tour');
    await page.waitForSelector('.tour');
    expect(await tourTitle(page)).toBe('Profiles');
    await clickButton(page, 'Skip tour');
    await expect.poll(() => page.$('.tour')).toBeNull();
  });
});
