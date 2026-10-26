import { starterProfiles } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';
import type { Page } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launch, setStored, wait, type TestBrowser } from './harness';

// Writing as it ships, but with every site tamed so every drawing shows. Reddit and
// YouTube keep their starter toggles, which the tests below rely on.
const everySiteTamed = starterProfiles.map((profile) =>
  profile.id !== 'writing'
    ? profile
    : {
        ...profile,
        sites: recipes.map(
          (recipe) =>
            profile.sites.find((site) => site.recipeId === recipe.id && site.level === 'tamed') ?? {
              recipeId: recipe.id,
              level: 'tamed' as const,
            },
        ),
      },
);

describe('recipe previews in settings', () => {
  let t: TestBrowser;
  let page: Page;

  const row = (site: string) => `li:has([aria-label="${site} level"])`;
  const regions = (site: string) =>
    page.$$eval(`${row(site)} .region`, (els) =>
      Object.fromEntries(els.map((el) => [(el as HTMLElement).dataset.toggle, el.className])),
    );
  const toggleSwitch = (site: string, label: string) =>
    page.$$eval(
      `${row(site)} [role=switch]`,
      (els, wanted) => els.findIndex((el) => el.querySelector('.label')!.textContent === wanted),
      label,
    );

  beforeAll(async () => {
    t = await launch();
    page = await t.browser.newPage();
    await page.setViewport({ width: 900, height: 1600 });
    await page.goto(`chrome-extension://${t.extensionId}/options.html`);
    await page.waitForSelector('[role=tab]');
    await setStored(page, { profiles: everySiteTamed });
    await wait(300);
  });
  afterAll(() => t?.close());

  it('draws every toggle that hides something, on every site', async () => {
    for (const recipe of recipes) {
      expect(await page.$(`${row(recipe.name)} figure`), recipe.name).not.toBeNull();
      const pageCount = Math.max(1, (await page.$$(`${row(recipe.name)} .page-tabs button`)).length);
      const seen = new Set<string>();
      for (let n = 1; n <= pageCount; n++) {
        if (pageCount > 1) await page.click(`${row(recipe.name)} .page-tabs button:nth-child(${n})`);
        await wait(50);
        Object.keys(await regions(recipe.name)).forEach((toggle) => seen.add(toggle));
      }
      const hiding = recipe.toggles.filter((toggle) => toggle.selectors?.length).map((toggle) => toggle.id);
      expect([...seen].sort(), recipe.name).toEqual(hiding.sort());
    }
  });

  it('collapses what a toggle hides, and brings it back', async () => {
    expect((await regions('Reddit')).hidePromoted).toContain('hidden');
    const index = await toggleSwitch('Reddit', 'Hide promoted posts');
    await (await page.$$(`${row('Reddit')} [role=switch]`))[index]!.click();
    await wait(150);
    expect((await regions('Reddit')).hidePromoted).not.toContain('hidden');
  });

  it('turns the drawing gray with grayscale', async () => {
    expect(await page.$eval(`${row('Reddit')} .mock`, (el) => el.classList.contains('grayscale'))).toBe(true);
  });

  it('outlines what a toggle hides while pointing at it', async () => {
    const index = await toggleSwitch('Reddit', 'Hide suggested posts');
    await (await page.$$(`${row('Reddit')} [role=switch]`))[index]!.hover();
    await wait(100);
    expect((await regions('Reddit')).hideSuggested).toContain('highlighted');
    await page.mouse.move(0, 0);
    await wait(100);
    expect((await regions('Reddit')).hideSuggested).not.toContain('highlighted');
  });

  it("switches to the page a toggle changes when it isn't on this one", async () => {
    const shownPage = () =>
      page.$eval(`${row('YouTube')} .page-tabs [aria-pressed=true]`, (b) => b.textContent!.trim());
    await page.click(`${row('YouTube')} .page-tabs button:first-child`);
    expect(await shownPage()).toBe('Home');

    const index = await toggleSwitch('YouTube', 'Hide comments');
    await (await page.$$(`${row('YouTube')} [role=switch]`))[index]!.focus();
    await wait(100);
    expect(await shownPage()).toBe('Video');
    expect((await regions('YouTube')).hideComments).toContain('highlighted');
  });
});
