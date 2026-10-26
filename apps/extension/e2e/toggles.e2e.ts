import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launch, openPopup, stored, text, urls, visibility, wait, type TestBrowser } from './harness';

const switches = (popup: Page) =>
  popup.$$eval('[role=switch]', (els) =>
    Object.fromEntries(els.map((el) => [el.querySelector('.label')!.textContent, el.getAttribute('aria-checked') === 'true'])),
  );

const flip = (popup: Page, label: string) =>
  popup.$$eval(
    '[role=switch]',
    (els, wanted) => (els.find((el) => el.querySelector('.label')!.textContent === wanted) as HTMLElement).click(),
    label,
  );

const writing = (storage: Record<string, any>) => storage.profiles.find((p: { id: string }) => p.id === 'writing').sites[0];

// One browser for the whole file; each test picks up where the last one left off.
describe('popup toggles', () => {
  let t: TestBrowser;
  let reddit: Page;
  let popup: Page;
  const page = () => visibility(reddit, ['feed', 'ad']);

  beforeAll(async () => {
    t = await launch();
    reddit = await t.browser.newPage();
    await reddit.goto(urls.reddit);
    popup = await openPopup(t, reddit);
  });
  afterAll(() => t?.close());

  describe('without a session', () => {
    it('shows the site and a profile picker', async () => {
      expect(await text(popup)).toContain('On this site · Reddit');
      expect(await popup.$('select')).not.toBeNull();
    });

    it('reflects the selected profile', async () => {
      expect(await switches(popup)).toMatchObject({ Grayscale: true, 'Hide promoted posts': true });
    });

    it('edits the profile without touching the page', async () => {
      await flip(popup, 'Hide promoted posts');
      await wait(200);
      expect(writing(await stored(popup)).toggles.hidePromoted).toBe(false);
      expect(await page()).toEqual({ feed: true, ad: true, grayscale: false });
    });

    it('switches profiles with the picker', async () => {
      await popup.select('select', 'wind-down');
      await wait(150);
      expect(await switches(popup)).toMatchObject({ Grayscale: false, 'Hide promoted posts': true });
      await popup.select('select', 'writing');
    });
  });

  describe('during a session', () => {
    beforeAll(async () => {
      await popup.click('button.profile');
      await popup.waitForSelector('.elapsed');
      await wait(300);
    });

    it('uses the edited profile and hides the picker', async () => {
      expect(await page()).toEqual({ feed: false, ad: true, grayscale: true });
      expect(await popup.$('select')).toBeNull();
    });

    it('changes open tabs live for this session only', async () => {
      await flip(popup, 'Grayscale');
      await wait(300);
      expect((await page()).grayscale).toBe(false);
      expect(await text(popup)).toContain('Changed for this session');
      expect(await text(popup)).toContain('Save to Writing');

      const storage = await stored(popup);
      expect(writing(storage).toggles.grayscale).toBe(true);
      expect(storage.activeSession.overrides).toEqual({ reddit: { grayscale: false } });
    });

    it('forgets the change when it is flipped back', async () => {
      await flip(popup, 'Grayscale');
      await wait(200);
      expect((await stored(popup)).activeSession.overrides).toBeUndefined();
    });

    it('saves session changes to the profile', async () => {
      await flip(popup, 'Hide trending searches');
      await wait(150);
      await popup.click('button.save');
      await wait(200);

      const storage = await stored(popup);
      expect(writing(storage).toggles.hideTrending).toBe(false);
      expect(storage.activeSession.overrides).toBeUndefined();
      expect(await text(popup)).not.toContain('Changed for this session');
    });
  });

  it('has no site section on unrelated sites', async () => {
    await popup.close();
    const other = await t.browser.newPage();
    await other.goto(urls.other);
    popup = await openPopup(t, other);
    expect(await text(popup)).not.toContain('On this site');
  });
});
