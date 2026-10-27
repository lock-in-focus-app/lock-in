import type { Satellite, ToDesktop } from '@lock-in/core';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeDesktopApp, type FakeDesktopApp } from './fakeDesktopApp';
import {
  controlPage,
  launch,
  openPopup,
  redirectPage,
  setStored,
  startSession,
  stored,
  text,
  until,
  urls,
  type TestBrowser,
} from './harness';

/** The satellites the extension keeps, as text and state. */
const kept = async (control: Page) => ((await stored(control)).satellites ?? []).map((s) => [s.text, s.state]);

async function launchFrom(page: Page, thought: string): Promise<void> {
  await page.type('#satellite', thought);
  await page.keyboard.press('Enter');
}

// One browser for the whole file, with no desktop app; each test picks up where the last left off.
describe('satellites without the desktop app', () => {
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

  it('launches from the popup during a session', async () => {
    await startSession(control, 'deep-work');
    const popup = await openPopup(t, tab);
    // Ready to type into as soon as the popup opens.
    expect(await popup.evaluate(() => document.activeElement?.id)).toBe('satellite');
    await launchFrom(popup, '  reply to Sam ');
    await expect.poll(() => kept(control)).toEqual([['reply to Sam', 'orbiting']]);
    await expect.poll(() => text(popup)).toContain('Launched · 1 in orbit');
    expect(await popup.$eval('#satellite', (input) => (input as HTMLInputElement).value)).toBe('');
  });

  it('launches from a redirect page', async () => {
    const gate = await t.browser.newPage();
    await gate.goto(redirectPage(t, urls.x));
    await gate.waitForSelector('#satellite');
    expect(await text(gate)).toContain('Satellites · thoughts for later');
    await launchFrom(gate, 'book the dentist');
    await expect
      .poll(() => kept(control))
      .toEqual([
        ['reply to Sam', 'orbiting'],
        ['book the dentist', 'orbiting'],
      ]);
    await gate.close();
  });

  it('brings them back quietly when the session ends', async () => {
    const popup = await openPopup(t, tab);
    await popup.click('button.end');
    await expect
      .poll(() => kept(control))
      .toEqual([
        ['reply to Sam', 'back'],
        ['book the dentist', 'back'],
      ]);
    await popup.waitForSelector('.back');
    expect(await text(popup)).toContain('2 satellites came back');
  });

  it('keeps tasks, and lets one ticked off by accident be unticked', async () => {
    let popup = await openPopup(t, tab);
    const actOn = async (index: number, action: string) => {
      const [item] = (await popup.$$('.back .satellite')).slice(index);
      await (await item!.$(`button.${action}`))!.click();
    };
    await actOn(1, 'task');
    await expect
      .poll(() => kept(control))
      .toEqual([
        ['reply to Sam', 'back'],
        ['book the dentist', 'task'],
      ]);
    await actOn(0, 'done');
    // Never a task, so ticking it off lets it go.
    await expect.poll(() => kept(control)).toEqual([['book the dentist', 'task']]);
    await popup.waitForSelector('.back', { hidden: true });

    await popup.click('.tasks input[type=checkbox]');
    await expect.poll(() => kept(control)).toEqual([['book the dentist', 'done']]);
    popup = await openPopup(t, tab);
    expect(await text(popup)).toContain('Done · last 24 hours');
    await popup.click('.tasks li.done input[type=checkbox]');
    await expect.poll(() => kept(control)).toEqual([['book the dentist', 'task']]);
  });

  it('keeps thoughts launched between sessions in orbit until the next one ends', async () => {
    const popup = await openPopup(t, tab);
    await launchFrom(popup, 'water the plants');
    await expect.poll(() => text(popup)).toContain('In orbit · back after your next session');
    await startSession(control, 'writing');
    // A session starting isn't one ending.
    expect(await kept(control)).toContainEqual(['water the plants', 'orbiting']);
    await setStored(control, { activeSession: null });
    await expect.poll(() => kept(control)).toContainEqual(['water the plants', 'back']);
  });
});

describe('satellites with the desktop app', () => {
  let app: FakeDesktopApp;
  let t: TestBrowser;
  let control: Page;
  const handedOver = async () =>
    (await app.received())
      .filter((m): m is Extract<ToDesktop, { type: 'satellite' }> => m.type === 'satellite')
      .map((m) => m.satellite);

  beforeAll(async () => {
    // Not linked yet: the app links once the test has something for it.
    app = await fakeDesktopApp([]);
    t = await launch({ nativeHost: app.host });
    control = await controlPage(t);
  });
  afterAll(async () => {
    await t?.close();
    await app?.remove();
  });

  it('hands over the satellites it kept once the app links', async () => {
    const task: Satellite = { id: 'kept', text: 'call the bank', launchedAt: 1, state: 'task', stateAt: 2 };
    await setStored(control, { satellites: [task] });
    await app.send({ type: 'linked' });
    await expect.poll(handedOver).toEqual([task]);
    // Kept until the app says it has it.
    expect(await kept(control)).toEqual([['call the bank', 'task']]);
    await app.send({ type: 'satelliteKept', id: 'kept' });
    await expect.poll(() => kept(control)).toEqual([]);
  });

  it('sends ones launched while linked straight to the app', async () => {
    const tab = await t.browser.newPage();
    await tab.goto(urls.other);
    const popup = await openPopup(t, tab);
    await launchFrom(popup, 'look up flights');
    await expect
      .poll(async () => (await handedOver()).at(-1))
      .toMatchObject({
        text: 'look up flights',
        state: 'orbiting',
      });
    const { id } = (await handedOver()).at(-1)!;
    await app.send({ type: 'satelliteKept', id });
    await expect.poll(() => kept(control)).toEqual([]);
    // "Launched · it waits in the Lock In app", or once that's faded, "Kept in the Lock In app".
    expect(await text(popup)).toContain('in the Lock In app');
    await tab.close();
  });

  it('keeps them if the app goes away first, and hands them over next time', async () => {
    await app.send({ type: 'unlinked' });
    await until('the link to drop', async () =>
      control.evaluate(() =>
        (globalThis as unknown as { chrome: typeof browser }).chrome.storage.session
          .get('desktopLinked')
          .then((items) => items.desktopLinked !== true),
      ),
    );
    const tab = await t.browser.newPage();
    await tab.goto(urls.other);
    const popup = await openPopup(t, tab);
    await launchFrom(popup, 'renew passport');
    await expect.poll(() => kept(control)).toEqual([['renew passport', 'orbiting']]);
    const before = (await handedOver()).length;

    await app.send({ type: 'linked' });
    await expect.poll(async () => (await handedOver()).slice(before)).toMatchObject([{ text: 'renew passport' }]);
  });
});
