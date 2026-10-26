import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launch, stored, wait, type TestBrowser } from './harness';

describe('settings page', () => {
  let t: TestBrowser;
  let page: Page;

  const deepWork = async () => (await stored(page)).profiles!.find((p) => p.id === 'deep-work')!.redirect!;
  // Each click works from what's on screen, so tests wait for one change to be saved (and
  // drawn) before the next, as a person would. A slow CI runner can take a while.
  const savedDestinations = (expected: string[]) =>
    expect.poll(async () => (await deepWork()).destinations).toEqual(expected);
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

  const clickSwitch = (label: string) =>
    page.$$eval(
      '[role=switch]',
      (els, wanted) => (els.find((el) => el.querySelector('.label')!.textContent === wanted) as HTMLElement).click(),
      label,
    );
  const switchState = (label: string) =>
    page.$$eval(
      '[role=switch]',
      (els, wanted) => {
        const el = els.find((e) => e.querySelector('.label')!.textContent === wanted) as HTMLButtonElement;
        return { on: el.getAttribute('aria-checked') === 'true', disabled: el.disabled };
      },
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

  it("shows the profile's redirect pages, and the gate on its own", async () => {
    const checked = await page.$$eval('.destinations label', (labels) =>
      labels.filter((l) => l.querySelector('input')!.checked).map((l) => l.querySelector('.name')!.textContent),
    );
    expect(checked).toEqual(['Quote', "I'm stuck"]);
    expect(await switchState('Show the gate right away')).toEqual({ on: true, disabled: false });
  });

  it('turns pages on and off', async () => {
    await clickDestination('Quote');
    await savedDestinations(['gate', 'stuck']);
    await clickDestination('Your links');
    await savedDestinations(['gate', 'link', 'stuck']);
    expect(await page.$eval('main', (main) => main.textContent)).toContain('Your links is skipped for now');
  });

  it('always leaves somewhere to land', async () => {
    await clickSwitch('Show the gate right away');
    await savedDestinations(['link', 'stuck']);
    await clickDestination('Your links');
    await savedDestinations(['stuck']);
    expect(await page.$$eval('.destinations input:disabled', (inputs) => inputs.length)).toBe(1);

    // With the gate as the only choice, it's the switch that can't be turned off.
    await clickSwitch('Show the gate right away');
    await savedDestinations(['gate', 'stuck']);
    await clickDestination("I'm stuck");
    await savedDestinations(['gate']);
    expect(await switchState('Show the gate right away')).toEqual({ on: true, disabled: true });
    expect(await page.$eval('main', (main) => main.textContent)).toContain('every redirected visit goes straight to');
  });

  it('saves gate settings', async () => {
    await clickSwitch('Require a reason to continue');
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
