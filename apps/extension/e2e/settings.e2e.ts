import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launch, stored, type TestBrowser } from './harness';

describe('settings page', () => {
  let t: TestBrowser;
  let page: Page;

  const deepWork = async () => (await stored(page)).profiles?.find((p) => p.id === 'deep-work')?.redirect;
  const clickSwitch = (label: string) =>
    page.$$eval(
      '[role=switch]',
      (els, wanted) => (els.find((el) => el.querySelector('.label')!.textContent === wanted) as HTMLElement).click(),
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
    await page.waitForFunction(
      () => document.querySelector('[role=tab][aria-selected=true]')?.textContent?.trim() === 'Deep Work',
    );
  });
  afterAll(() => t?.close());

  it('ends with the quiet support link, opening in its own tab', async () => {
    const link = await page.$eval('footer .support a', (a) => ({
      text: (a as HTMLElement).innerText,
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
    }));
    expect(link).toEqual({ text: 'SUPPORT LOCK IN ON KO-FI ↗', href: 'https://ko-fi.com/sortelone', target: '_blank' });
  });

  it('saves the if-then plan when you leave the field', async () => {
    await page.type('input[aria-label="Your if-then plan"]', "  When I want Reddit, I'll write one paragraph first. ");
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await deepWork())?.plan).toBe("When I want Reddit, I'll write one paragraph first.");
  });

  it('saves the wait and pass settings', async () => {
    await clickSwitch('Require a reason to go on');
    await page.select('select[aria-label="When a pass runs out"]', 'redirect');
    // Five minutes by default, said in words.
    expect(await page.$eval('main', (main) => main.textContent)).toContain('Focus for 5 minutes first');
    const seconds = await page.waitForSelector('input[aria-label="Wait in seconds"]');
    await seconds!.click({ count: 3 });
    await seconds!.type('999');
    await page.keyboard.press('Tab');

    await expect
      .poll(async () => (await deepWork())?.gate)
      .toMatchObject({
        requireReason: true,
        onPassExpiry: 'redirect',
        wait: { mode: 'fixed', seconds: 600 },
      });
    expect(await page.$eval('input[aria-label="Wait in seconds"]', (input) => input.value)).toBe('600');
    expect(await page.$eval('main', (main) => main.textContent)).toContain('Focus for 10 minutes first');
  });

  it('adds links, assuming https', async () => {
    await page.type('input[aria-label="Link address"]', 'javascript:alert(1)');
    await page.click('form.add:has(input[aria-label="Link address"]) button[type=submit]');
    expect(await page.$eval('.error[role=alert]', (el) => el.textContent)).toContain('Enter a web address');

    await page.type('input[aria-label="Link name"]', 'Draft');
    await page.click('input[aria-label="Link address"]', { count: 3 });
    await page.type('input[aria-label="Link address"]', 'docs.example.com/draft');
    await page.click('form.add:has(input[aria-label="Link address"]) button[type=submit]');
    await expect
      .poll(async () => (await deepWork())?.links)
      .toMatchObject([{ title: 'Draft', url: 'https://docs.example.com/draft' }]);
  });
});
