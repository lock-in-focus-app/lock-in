import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { starterProfiles, type Profile } from '@lock-in/core';
import puppeteer, { type Browser, type Extension, type Page } from 'puppeteer';

// Browser tests load the real extension build into Chrome for Testing and point it at
// local fixture pages. Real sites can't be served locally (they're HSTS-preloaded, so
// Chrome insists on HTTPS), so a copy of the build has its site patterns rewritten to
// `.test` domains, which Chrome resolves to a local server.

const buildDir = join(import.meta.dirname, '../.output/chrome-mv3');
const fixturesDir = join(import.meta.dirname, 'fixtures');

const testDomains: Record<string, string> = {
  '*.reddit.com/': '*.reddit.test/',
  '*.x.com/': '*.x.test/',
  '*.twitter.com/': '*.twitter.test/',
};

export const urls = {
  reddit: 'http://www.reddit.test/',
  x: 'http://x.test/home',
  other: 'http://other.test/',
};

export interface TestBrowser {
  browser: Browser;
  extension: Extension;
  extensionId: string;
  close(): Promise<void>;
}

export async function launch(): Promise<TestBrowser> {
  const extensionDir = await copyBuildForTests();
  const server = await serveFixtures();
  const { port } = server.address() as AddressInfo;

  const browser = await puppeteer.launch({
    headless: true,
    pipe: true,
    enableExtensions: true,
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
  await popup.setViewport({ width: 300, height: 520 });
  await popup.waitForSelector('main');
  await wait(300);
  return popup;
}

/** Everything in the extension's local storage, read from one of its pages. */
export function stored(extensionPage: Page): Promise<Record<string, any>> {
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
export async function setProfileRedirect(extensionPage: Page, profileId: string, redirect: Profile['redirect']): Promise<void> {
  const list: Profile[] = (await stored(extensionPage)).profiles ?? starterProfiles;
  await setStored(extensionPage, { profiles: list.map((p) => (p.id === profileId ? { ...p, redirect } : p)) });
}

/** Starts a session without going through the popup. */
export async function startSession(extensionPage: Page, profileId: string): Promise<void> {
  await setStored(extensionPage, { activeSession: { id: 'e2e', profileId, startedAt: Date.now() } });
  await wait(300);
}

/** The URL a redirected visit lands on. */
export const redirectPage = ({ extensionId }: TestBrowser, target: string, expired = false) =>
  `chrome-extension://${extensionId}/redirect.html${expired ? '?expired' : ''}#${target}`;

/** Writes straight to the extension's local storage, e.g. to fast-forward a pass. */
export async function setStored(extensionPage: Page, values: Record<string, unknown>): Promise<void> {
  await extensionPage.evaluate(
    (items) => (globalThis as unknown as { chrome: typeof browser }).chrome.storage.local.set(items),
    values,
  );
}

export function text(page: Page): Promise<string> {
  return page.$eval('main', (main) => (main as HTMLElement).innerText);
}

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
  const pages: Record<string, string> = {
    'www.reddit.test': await readFile(join(fixturesDir, 'reddit.html'), 'utf8'),
    'x.test': '<!doctype html><title>Fake X</title><p id="post">A post</p>',
  };
  const server = createServer((req, res) => {
    const host = req.headers.host?.split(':')[0] ?? '';
    res.setHeader('content-type', 'text/html');
    res.end(pages[host] ?? '<!doctype html><title>Other</title><p>An unrelated site</p>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
