import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controlPage, launch, setProfileRedirect, startSession, stored, urls, type TestBrowser } from './harness';

describe('the redirect page', () => {
  let t: TestBrowser;
  let control: Page;
  let tab: Page;

  const pageText = () => tab.$eval('main', (main) => (main as HTMLElement).innerText);
  // Some buttons only show up once an earlier click has been saved, so this waits for them.
  const clickButton = async (label: string) => {
    const find = (wanted: string) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent!.trim() === wanted);
    await tab.waitForFunction(`(${find})(${JSON.stringify(label)}) !== undefined`);
    await tab.evaluate(`(${find})(${JSON.stringify(label)}).click()`);
  };
  /** The time left on the page's clock, in seconds. */
  const clockSeconds = async () => {
    const [minutes, seconds] = (await tab.$eval('.clock', (el) => el.textContent!.trim())).split(':').map(Number);
    return minutes! * 60 + seconds!;
  };

  /** Sets Deep Work's redirect settings, then visits Reddit. */
  async function visitWith(redirect: Parameters<typeof setProfileRedirect>[2]) {
    await setProfileRedirect(control, 'deep-work', redirect);
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

  describe('by default', () => {
    beforeAll(() => visitWith(undefined));

    it('asks for five minutes of focus first', async () => {
      const text = await pageText();
      expect(text).toContain('First try at Reddit today');
      expect(text).toContain('Focus for 5 minutes first');
      expect(text).toContain('If you still want Reddit after that, go right ahead.');
      expect(await clockSeconds()).toBeGreaterThan(295);
      expect(
        await tab.$eval('button.continue', (b) => ({ disabled: b.disabled, label: b.textContent!.trim() })),
      ).toEqual({ disabled: true, label: 'Go to Reddit' });
      expect(await tab.$('textarea')).toBeNull();
    });

    it('shows a quote when the profile has no plan', async () => {
      expect(await tab.$eval('figure.quote blockquote', (el) => el.textContent!.trim())).not.toBe('');
    });

    it('records the trip and the one-tap "why"', async () => {
      await clickButton('Bored');
      await expect
        .poll(async () => (await stored(control)).gateVisits?.at(-1))
        .toMatchObject({ recipeId: 'reddit', destination: 'page', why: 'bored' });
    });

    it('keeps the wait going when you leave and come back', async () => {
      const first = (await stored(control)).pageWaits?.reddit;
      expect(first).toMatchObject({ sessionId: 'e2e', seconds: 300 });

      await tab.goto(urls.other);
      await tab.goto(urls.reddit);
      await tab.waitForSelector('.badge');
      expect(await pageText()).toContain('2nd try at Reddit today');
      expect((await stored(control)).pageWaits?.reddit).toEqual(first);
    });
  });

  describe('with a plan and links', () => {
    beforeAll(() =>
      visitWith({
        plan: "When I want Reddit, I'll write one paragraph first.",
        links: [{ id: 'l', title: 'My draft', url: 'https://docs.example.com/draft' }],
      }),
    );

    it('shows the if-then plan instead of a quote', async () => {
      expect(await tab.$eval('figure.plan', (el) => (el as HTMLElement).innerText)).toContain(
        "When I want Reddit, I'll write one paragraph first.",
      );
      expect(await tab.$('figure.quote')).toBeNull();
    });

    it('offers your links as ways back to work', async () => {
      expect(await tab.$eval('a.link', (a) => a.getAttribute('href'))).toBe('https://docs.example.com/draft');
      expect(await tab.$eval('a.link .title', (el) => el.textContent!.trim())).toBe('My draft ↗');
    });
  });

  describe("I'm stuck", () => {
    beforeAll(() => visitWith(undefined));

    it('walks through the steps in place, and repeats the next step back', async () => {
      await clickButton("I'm stuck");
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

    it('goes back to the wait', async () => {
      await clickButton('Back to the wait');
      expect(await pageText()).toContain('Focus for 5 minutes first');
    });
  });

  describe('settings', () => {
    it('can require a reason', async () => {
      await visitWith({ gate: { requireReason: true, wait: { mode: 'fixed', seconds: 0 } } });
      expect(await pageText()).toContain('Still want Reddit?');
      // With no wait, only the missing reason holds the way through back.
      expect(await tab.$eval('button.continue', (b) => b.disabled)).toBe(true);
      await tab.type('textarea', 'Reply to a message');
      expect(await tab.$eval('button.continue', (b) => b.disabled)).toBe(false);
    });

    it('can make the wait longer with each try', async () => {
      const escalating = { mode: 'escalating', startSeconds: 20, stepSeconds: 20, maxSeconds: 50 } as const;
      await visitWith({ gate: { wait: escalating } });
      const attempt = (await stored(control)).gateVisits!.filter(
        (v: { recipeId: string }) => v.recipeId === 'reddit',
      ).length;
      const expected = Math.min(50, 20 + 20 * (attempt - 1));
      expect(expected - (await clockSeconds())).toBeLessThanOrEqual(1);

      // A new wait (the last one cleared, as if it had lapsed) is longer.
      await visitWith({ gate: { wait: escalating } });
      const next = Math.min(50, expected + 20);
      expect(next - (await clockSeconds())).toBeLessThanOrEqual(1);
    });
  });
});
