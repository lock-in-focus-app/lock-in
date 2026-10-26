import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, setProfileRedirect, startSession, stored, urls, wait, type TestBrowser } from './harness';

describe('redirect destinations', () => {
  let t: TestBrowser;
  let control: Page;
  let tab: Page;

  const pageText = () => tab.$eval('main', (main) => (main as HTMLElement).innerText);
  const clickButton = (label: string) =>
    tab.$$eval(
      'button',
      (buttons, wanted) => (buttons.find((b) => b.textContent!.trim() === wanted) as HTMLElement).click(),
      label,
    );
  const continueLabel = () => tab.$eval('button.continue', (b) => b.textContent!.trim());

  /** Sets Deep Work's redirect settings, then visits Reddit. */
  async function visitWith(redirect: Parameters<typeof setProfileRedirect>[2]) {
    await setProfileRedirect(control, 'deep-work', redirect);
    await wait(200);
    await tab.goto(urls.reddit);
    await tab.waitForSelector('.badge');
  }

  beforeAll(async () => {
    t = await launch();
    control = await controlPage(t);
    await startSession(control, 'deep-work');
    tab = await t.browser.newPage();
  });
  afterAll(() => t?.close());

  describe('quote card', () => {
    beforeAll(() => visitWith({ destinations: ['quote'] }));

    it('shows a quote', async () => {
      expect(await tab.$('blockquote')).not.toBeNull();
      expect(await pageText()).toContain('First try at Reddit today');
    });

    it('records the one-tap "why"', async () => {
      await clickButton('Bored');
      await wait(200);
      const { gateVisits } = await stored(control);
      expect(gateVisits.at(-1)).toMatchObject({ recipeId: 'reddit', destination: 'quote', why: 'bored' });
    });

    it('offers the unstick page when the answer is "stuck"', async () => {
      await clickButton('Stuck');
      await wait(100);
      await clickButton('Stuck? Try a 2-minute unstick');
      expect(await pageText()).toContain('A 2-minute unstick');
      expect((await stored(control)).gateVisits.at(-1).why).toBe('stuck');
    });

    it('can still go through the gate', async () => {
      await clickButton('Still need Reddit?');
      expect(await pageText()).toContain('What did you come here for?');
    });
  });

  describe("I'm stuck", () => {
    beforeAll(() => visitWith({ destinations: ['stuck'] }));

    it('walks through the steps and repeats the next step back', async () => {
      expect(await pageText()).toContain('Say it out loud');
      await clickButton('Next');
      await tab.type('input', 'Write the intro paragraph');
      await clickButton('Next');
      await clickButton('Next');
      expect(await pageText()).toContain('Breathe');
      await clickButton('Done');
      const text = await pageText();
      expect(text).toContain('Ready when you are');
      expect(text).toContain('Your next step: Write the intro paragraph');
    });
  });

  describe('your links', () => {
    beforeAll(() =>
      visitWith({ destinations: ['link'], links: [{ id: 'l', title: 'My draft', url: 'https://docs.example.com/draft' }] }),
    );

    it('offers one of the saved links', async () => {
      expect(await pageText()).toContain('My draft');
      expect(await tab.$eval('a.open', (a) => a.getAttribute('href'))).toBe('https://docs.example.com/draft');
    });
  });

  describe('intention gate settings', () => {
    it('can require a reason', async () => {
      await visitWith({ destinations: ['gate'], gate: { requireReason: true, wait: { mode: 'fixed', seconds: 0 } } });
      await wait(200);
      expect(await tab.$eval('button.continue', (b) => b.disabled)).toBe(true);
      await tab.type('textarea', 'Reply to a message');
      expect(await tab.$eval('button.continue', (b) => b.disabled)).toBe(false);
    });

    it('can make the wait longer with each try', async () => {
      const escalating = { mode: 'escalating', startSeconds: 20, stepSeconds: 20, maxSeconds: 50 } as const;
      await visitWith({ destinations: ['gate'], gate: { wait: escalating } });
      const attempt = (await stored(control)).gateVisits.filter((v: { recipeId: string }) => v.recipeId === 'reddit').length;
      const expected = Math.min(50, 20 + 20 * (attempt - 1));
      expect(await continueLabel()).toMatch(new RegExp(`^Continue in (${expected}|${expected - 1})s$`));

      await visitWith({ destinations: ['gate'], gate: { wait: escalating } });
      const next = Math.min(50, expected + 20);
      expect(await continueLabel()).toMatch(new RegExp(`^Continue in (${next}|${next - 1})s$`));
    });
  });
});
