import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  desktopHostName,
  starterProfiles,
  type GateVisit,
  type OwnQuote,
  type Profile,
  type Satellite,
  type Session,
} from '@lock-in/core';
import puppeteer, { type Browser, type Extension, type Page } from 'puppeteer';

// Browser tests load the real extension build into Chrome for Testing and point it at
// local fixture pages. Real sites can't be served locally (they're HSTS-preloaded, so
// Chrome insists on HTTPS), so a copy of the build has its site patterns rewritten to
// `.test` domains, which Chrome resolves to a local server.

const buildDir = join(import.meta.dirname, '../.output/chrome-mv3');
const fixturesDir = join(import.meta.dirname, 'fixtures');

const testDomains: Record<string, string> = {
  '*.reddit.com/': '*.reddit.test/',
  '*.youtube.com/': '*.youtube.test/',
  '*.x.com/': '*.x.test/',
  '*.twitter.com/': '*.twitter.test/',
  '*.instagram.com/': '*.instagram.test/',
  '*.tiktok.com/': '*.tiktok.test/',
  '*.facebook.com/': '*.facebook.test/',
  '*.linkedin.com/': '*.linkedin.test/',
  '*.pinterest.com/': '*.pinterest.test/',
};

export const urls = {
  reddit: 'http://www.reddit.test/',
  youtube: 'http://www.youtube.test/',
  x: 'http://x.test/home',
  instagram: 'http://www.instagram.test/',
  tiktok: 'http://www.tiktok.test/',
  facebook: 'http://www.facebook.test/',
  linkedin: 'http://www.linkedin.test/feed/',
  pinterest: 'http://www.pinterest.test/',
  other: 'http://other.test/',
};

/** The hosts of the sites above, which the popup has a section for. */
const siteHosts = new Set(
  Object.entries(urls)
    .filter(([site]) => site !== 'other')
    .map(([, url]) => new URL(url).host),
);

/** The extension's id in Chrome, fixed by the public key in its manifest. */
export const chromeExtensionId = 'nfaamgjiehkppopelaampopbofjoepca';

export interface TestBrowser {
  browser: Browser;
  extension: Extension;
  extensionId: string;
  close(): Promise<void>;
}

/**
 * Starts Chrome with the extension. `nativeHost` is an executable to use as the desktop
 * app's Native Messaging host; without one, the extension runs on its own.
 */
export async function launch({ nativeHost }: { nativeHost?: string } = {}): Promise<TestBrowser> {
  const extensionDir = await copyBuildForTests();
  const server = await serveFixtures();
  const { port } = server.address() as AddressInfo;

  // Chrome looks for host manifests in the profile folder, so a fresh one keeps tests apart.
  const userDataDir = await mkdtemp(join(tmpdir(), 'lock-in-profile-'));
  if (nativeHost) {
    await mkdir(join(userDataDir, 'NativeMessagingHosts'));
    const manifest = {
      name: desktopHostName,
      description: 'Fake Lock In app for tests',
      path: nativeHost,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${chromeExtensionId}/`],
    };
    await writeFile(join(userDataDir, 'NativeMessagingHosts', `${desktopHostName}.json`), JSON.stringify(manifest));
  }

  const browser = await puppeteer.launch({
    headless: true,
    pipe: true,
    enableExtensions: true,
    userDataDir,
    args: [
      `--host-resolver-rules=MAP *.test 127.0.0.1:${port}`,
      '--no-proxy-server',
      // GitHub's Ubuntu runners don't allow Chrome's sandbox.
      ...(process.env.CI ? ['--no-sandbox'] : []),
    ],
  });
  const extensionId = await browser.installExtension(extensionDir);
  const extension = (await browser.extensions()).get(extensionId)!;

  return {
    browser,
    extension,
    extensionId,
    async close() {
      await browser.close();
      server.close();
      await rm(extensionDir, { recursive: true, force: true });
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

/** Opens the popup the way a user would: by clicking the toolbar button on a tab. */
export async function openPopup({ browser, extension }: TestBrowser, tab: Page): Promise<Page> {
  const earlier = new Set(browser.targets());
  await tab.bringToFront();
  await tab.triggerExtensionAction(extension);
  const target = await browser.waitForTarget((t) => t.url().endsWith('/popup.html') && !earlier.has(t));
  const popup = (await target.asPage())!;
  // No setViewport here: Chrome doesn't let a popup's size be overridden, it sizes itself to its content.
  // The session (or the list to start one) shows once storage has loaded, and a site's
  // section once the popup has looked up the tab.
  await popup.waitForSelector('main > section');
  if (siteHosts.has(new URL(tab.url()).host)) await popup.waitForSelector('main > .site');
  return popup;
}

/** What the extension keeps in local storage. Keys are missing until something is saved. */
export interface Stored {
  activeSession?: Session | null;
  profiles?: Profile[];
  gateVisits?: GateVisit[];
  ownQuotes?: OwnQuote[];
  satellites?: Satellite[];
  syncedAt?: { profiles: number; activeSession: number };
  tourOffered?: boolean;
}

/** Everything in the extension's local storage, read from one of its pages. */
export function stored(extensionPage: Page): Promise<Stored> {
  return extensionPage.evaluate(() =>
    (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.get(null),
  );
}

/** Whether each element is visible, plus whether the page is grayscale. */
export function visibility(page: Page, ids: string[]): Promise<Record<string, boolean>> {
  return page.evaluate((list) => {
    const visible = Object.fromEntries(
      list.map((id) => [id, getComputedStyle(document.getElementById(id)!).display !== 'none']),
    );
    return { ...visible, grayscale: getComputedStyle(document.documentElement).filter.includes('grayscale') };
  }, ids);
}

/** An extension page left open in the background, for reading and writing storage. */
export async function controlPage({ browser, extensionId }: TestBrowser): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

/** Replaces a profile's redirect settings. */
export async function setProfileRedirect(
  extensionPage: Page,
  profileId: string,
  redirect: Profile['redirect'],
): Promise<void> {
  const list: Profile[] = (await stored(extensionPage)).profiles ?? starterProfiles;
  await setStored(extensionPage, { profiles: list.map((p) => (p.id === profileId ? { ...p, redirect } : p)) });
}

/** Starts a session without going through the popup. */
export async function startSession(extensionPage: Page, profileId: string): Promise<void> {
  await setStored(extensionPage, { activeSession: { id: 'e2e', profileId, startedAt: Date.now() } });
}

/** The URL a redirected visit lands on. */
export const redirectPage = ({ extensionId }: TestBrowser, target: string, expired = false) =>
  `chrome-extension://${extensionId}/redirect.html${expired ? '?expired' : ''}#${target}`;

/**
 * Writes straight to the extension's local storage, e.g. to fast-forward a pass, then waits
 * for the redirect rules to catch up, so visiting a site next sees the change. Open tabs
 * catch up by themselves, so check those with `expect.poll`.
 */
export async function setStored(extensionPage: Page, values: Record<string, unknown>): Promise<void> {
  await extensionPage.evaluate(
    (items) => (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.set(items),
    values,
  );
  await syncRedirects(extensionPage);
}

/**
 * Waits until what's stored passes `check`, e.g. after a click in the popup saves something,
 * then for the redirect rules to catch up.
 */
export async function storedWhen(extensionPage: Page, check: (storage: Stored) => boolean): Promise<void> {
  await until('storage to change', async () => check(await stored(extensionPage)));
  await syncRedirects(extensionPage);
}

/**
 * The background updates the redirect rules soon after storage changes. Asking it to sync
 * waits until they match what's stored now, the same way the gate's Continue does.
 */
function syncRedirects(extensionPage: Page): Promise<void> {
  return extensionPage.evaluate(() =>
    (globalThis as unknown as { chrome: typeof browser }).chrome.runtime.sendMessage({
      type: 'lock-in:sync-redirects',
    }),
  );
}

export function text(page: Page): Promise<string> {
  return page.$eval('main', (main) => (main as HTMLElement).innerText);
}

/**
 * Checks until `check` passes, for the setup before tests, where `expect.poll` can't be used.
 * Gives up after as long as `expect.poll` would.
 */
export async function until(waitingFor: string, check: () => Promise<boolean>): Promise<void> {
  const giveUpAt = Date.now() + 5_000;
  while (!(await check())) {
    if (Date.now() > giveUpAt) throw new Error(`Timed out waiting for ${waitingFor}`);
    await wait(50);
  }
}

/**
 * A fixed pause. Only for checking that something *doesn't* happen, or for real timers like a
 * pass running out; anything that should happen is waited for with `expect.poll` instead,
 * since a busy CI runner can take much longer than a fixed pause.
 */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function copyBuildForTests(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'lock-in-e2e-'));
  await cp(buildDir, dir, { recursive: true });

  const files = await readdir(dir, { recursive: true });
  for (const file of files.filter((f) => /\.(js|json|html)$/.test(f))) {
    const path = join(dir, file);
    const original = await readFile(path, 'utf8');
    const patched = Object.entries(testDomains).reduce((code, [real, test]) => code.replaceAll(real, test), original);
    if (patched !== original) await writeFile(path, patched);
  }
  return dir;
}

async function serveFixtures(): Promise<Server> {
  const fixture = (name: string) => readFile(join(fixturesDir, `${name}.html`), 'utf8');
  // Each site's page is served for every path, so tests can visit or pushState anywhere.
  const pages: Record<string, string> = {
    'www.reddit.test': await fixture('reddit'),
    'www.youtube.test': await fixture('youtube'),
    'x.test': await fixture('x'),
    'www.instagram.test': await fixture('instagram'),
    'www.tiktok.test': await fixture('tiktok'),
    'www.facebook.test': await fixture('facebook'),
    'www.linkedin.test': await fixture('linkedin'),
    'www.pinterest.test': await fixture('pinterest'),
  };
  const server = createServer((req, res) => {
    const host = req.headers.host?.split(':')[0] ?? '';
    res.setHeader('content-type', 'text/html');
    res.end(pages[host] ?? '<!doctype html><title>Other</title><p>An unrelated site</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
