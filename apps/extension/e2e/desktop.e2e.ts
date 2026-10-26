import { starterProfiles, type Session, type ToDesktop } from '@lock-in/core';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeDesktopApp, type FakeDesktopApp } from './fakeDesktopApp';
import {
  chromeExtensionId,
  controlPage,
  launch,
  openPopup,
  stored,
  text,
  urls,
  wait,
  type TestBrowser,
} from './harness';

const minute = 60_000;
const startedAt = Date.now() - 10 * minute;
const appSession: Session = {
  id: 'app-session',
  profileId: 'deep-work',
  startedAt,
  timer: { minutes: 25, onEnd: 'gentle', showSinceDone: false },
};

const states = (messages: ToDesktop[]) =>
  messages.filter((m): m is Extract<ToDesktop, { type: 'state' }> => m.type === 'state');

// One browser for the whole file, linked to a fake app; each test picks up where the last left off.
describe('the desktop app link', () => {
  let app: FakeDesktopApp;
  let t: TestBrowser;
  let control: Page;

  beforeAll(async () => {
    // The app is already running a session, started at its end after the browser last synced.
    app = await fakeDesktopApp([
      { type: 'linked' },
      {
        type: 'state',
        profiles: { value: starterProfiles, updatedAt: 0 },
        activeSession: { value: appSession, updatedAt: startedAt },
      },
    ]);
    t = await launch({ nativeHost: app.host });
    control = await controlPage(t);
    await wait(500);
  });
  afterAll(async () => {
    await t?.close();
    await app?.remove();
  });

  it('has the id the app allows', () => {
    expect(t.extensionId).toBe(chromeExtensionId);
  });

  it("picks up the app's session and timer", async () => {
    expect((await stored(control)).activeSession).toEqual(appSession);

    const tab = await t.browser.newPage();
    await tab.goto(urls.other);
    const popup = await openPopup(t, tab);
    const popupText = await text(popup);
    expect(popupText).toContain('App linked');
    expect(popupText).toContain('Locked in · Deep Work');
    expect(await popup.$eval('.elapsed', (el) => el.textContent)).toMatch(/^1[45]:\d\d$/);
    await tab.close();
  });

  it('says hello and sends its own state once linked', async () => {
    const received = await app.received();
    expect(received[0]).toEqual({ type: 'hello', protocol: 1, browser: 'chrome' });
    expect(states(received)[0]).toMatchObject({
      profiles: { updatedAt: 0 },
      activeSession: { value: null, updatedAt: 0 },
    });
  });

  it('reports gate visits', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(urls.x);
    await tab.waitForSelector('main');
    await wait(300);
    const visits = (await app.received()).filter((m) => m.type === 'gateVisit');
    expect(visits.at(-1)).toMatchObject({ type: 'gateVisit', visit: { recipeId: 'x' } });
    await tab.close();
  });

  it('sends sessions ended in the browser to the app', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(urls.other);
    const popup = await openPopup(t, tab);
    await popup.click('button.end');
    await wait(300);

    const last = states(await app.received()).at(-1)!;
    expect(last.activeSession?.value).toBeNull();
    expect(last.activeSession!.updatedAt).toBeGreaterThan(startedAt);
    expect(last.profiles).toBeUndefined();
    await tab.close();
  });

  it('applies sessions started in the app', async () => {
    const session = { ...appSession, id: 'second', profileId: 'writing', startedAt: Date.now() };
    await app.send({
      type: 'state',
      profiles: { value: starterProfiles, updatedAt: 0 },
      activeSession: { value: session, updatedAt: Date.now() },
    });
    await wait(500);
    expect((await stored(control)).activeSession).toEqual(session);

    // The app's own change doesn't bounce back to it as a new one.
    const echoed = states(await app.received()).filter((m) => m.activeSession?.value?.id === 'second');
    expect(echoed).toEqual([]);
  });

  it('ignores changes older than its own', async () => {
    await app.send({
      type: 'state',
      profiles: { value: [], updatedAt: 0 },
      activeSession: { value: null, updatedAt: startedAt },
    });
    await wait(500);
    const storage = await stored(control);
    expect(storage.activeSession?.id).toBe('second');
    expect(storage.profiles).toBeUndefined();
  });

  it('carries on by itself once the app goes away', async () => {
    await app.send({ type: 'unlinked' });
    await wait(500);
    const before = (await stored(control)).syncedAt!.activeSession;
    const tab = await t.browser.newPage();
    await tab.goto(urls.other);
    const popup = await openPopup(t, tab);
    expect(await text(popup)).not.toContain('App linked');
    await popup.click('button.end');
    await wait(300);
    const storage = await stored(control);
    expect(storage.activeSession ?? null).toBeNull();
    // Still stamped, so this change wins when the app links again.
    expect(storage.syncedAt!.activeSession).toBeGreaterThan(before);
  });
});

describe('without the desktop app', () => {
  it('works on its own', async () => {
    const t = await launch();
    try {
      const control = await controlPage(t);
      await wait(300);
      const tab = await t.browser.newPage();
      await tab.goto(urls.other);
      const popup = await openPopup(t, tab);
      expect(await text(popup)).not.toContain('App linked');
      await popup.click('button.profile');
      await popup.waitForSelector('.elapsed');
      expect((await stored(control)).activeSession?.profileId).toBe('writing');
    } finally {
      await t.close();
    }
  });
});
