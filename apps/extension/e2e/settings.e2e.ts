import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launch, stored, wait, type TestBrowser } from './harness';

describe('settings page', () => {
  let t: TestBrowser;
  let page: Page;

  const deepWork = async () => (await stored(page)).profiles!.find((p) => p.id === 'deep-work')!.redirect!;
  const clickDestination = (label: string) =>
    page.$$eval(
      '.destinations label',
      (labels, wanted) =>
        labels
          .find((l) => l.querySelector('.name')!.textContent === wanted)!
          .querySelector('input')!
          .click(),
      label,
    );

  beforeAll(async () => {
    t = await launch();
    page = await t.browser.newPage();
    await page.goto(`chrome-extension://${t.extensionId}/options.html`);
    await page.waitForSelector('[role=tab]');
    await page.$$eval('[role=tab]', (tabs) =>
      (tabs.find((tab) => tab.textContent!.trim() === 'Deep Work') as HTMLElement).click(),
    );
    await wait(100);
  });
  afterAll(() => t?.close());

  it("shows the profile's destinations", async () => {
    const checked = await page.$$eval('.destinations label', (labels) =>
      labels.filter((l) => l.querySelector('input')!.checked).map((l) => l.querySelector('.name')!.textContent),
    );
    expect(checked).toEqual(['Intention gate', 'Quote', "I'm stuck"]);
  });

  it('turns destinations on and off', async () => {
    await clickDestination('Quote');
    await clickDestination('Your links');
    await wait(150);
    expect((await deepWork()).destinations).toEqual(['gate', 'link', 'stuck']);
  });

  it('keeps at least one destination', async () => {
    await clickDestination('Intention gate');
    await clickDestination('Your links');
    await wait(150);
    expect((await deepWork()).destinations).toEqual(['stuck']);
    expect(await page.$$eval('.destinations input:disabled', (inputs) => inputs.length)).toBe(1);
  });

  it('saves gate settings', async () => {
    await page.click('[role=switch]');
    await page.select('select[aria-label="When a pass runs out"]', 'redirect');
    await page.select('select[aria-label="Wait before Continue"]', 'fixed');
    await wait(100);
    const wait10 = await page.$('input[aria-label="Wait in seconds"]');
    await wait10!.click({ count: 3 });
    await wait10!.type('999');
    await page.keyboard.press('Tab');
    await wait(150);

    const { gate } = await deepWork();
    expect(gate).toMatchObject({
      requireReason: true,
      onPassExpiry: 'redirect',
      wait: { mode: 'fixed', seconds: 300 },
    });
    expect(await page.$eval('input[aria-label="Wait in seconds"]', (input) => input.value)).toBe('300');
  });

  it('adds links, assuming https', async () => {
    await page.type('input[aria-label="Link address"]', 'javascript:alert(1)');
    await page.click('form.add button[type=submit]');
    expect(await page.$eval('.error', (el) => el.textContent)).toContain('Enter a web address');

    await page.type('input[aria-label="Link name"]', 'Draft');
    await page.click('input[aria-label="Link address"]', { count: 3 });
    await page.type('input[aria-label="Link address"]', 'docs.example.com/draft');
    await page.click('form.add button[type=submit]');
    await wait(150);
    expect((await deepWork()).links).toMatchObject([{ title: 'Draft', url: 'https://docs.example.com/draft' }]);
  });

  it('adds and removes your own quotes', async () => {
    await page.type('input[aria-label="Quote"]', 'Ship it.');
    await page.type('input[aria-label="Author"]', 'Me');
    await page.$$eval('form.add', (forms) => forms[1]!.requestSubmit());
    await wait(150);
    expect((await stored(page)).ownQuotes).toMatchObject([{ text: 'Ship it.', author: 'Me' }]);

    await page.click('button[aria-label="Remove quote"]');
    await wait(150);
    expect((await stored(page)).ownQuotes).toEqual([]);
  });
});
