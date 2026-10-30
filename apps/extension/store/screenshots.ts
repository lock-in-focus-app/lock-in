import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { recipes } from '@lock-in/recipes';
import { starterProfiles, type Profile } from '@lock-in/core';
import type { Page } from 'puppeteer';
import { it } from 'vitest';
import { controlPage, launch, openPopup, setProfileRedirect, setStored, stored, urls } from '../e2e/harness';

// The store listing's images: five 1280×800 screenshots and the 440×280 promo tile, in
// .output/store-screenshots. Run with `pnpm --filter @lock-in/extension screenshots`, which
// builds first. Each screenshot is a real capture of the extension (through the browser tests'
// harness), set on the night sky with a headline. Both stores want PNGs without transparency,
// which a page screenshot with its own background is.

const out = join(import.meta.dirname, '../.output/store-screenshots');
const youtube = recipes.find((recipe) => recipe.id === 'youtube')!;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Each capture, as a data URL to put in a composed page. */
type Captures = Record<string, string>;

const asImage = (png: Uint8Array) => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

async function capture(): Promise<Captures> {
  const t = await launch();
  const shots: Captures = {};
  try {
    const control = await controlPage(t);
    await setProfileRedirect(control, 'writing', {
      plan: "When I want to scroll, I'll write one paragraph first.",
      links: [
        { id: 'draft', title: 'My draft', url: 'https://docs.example.com/draft' },
        { id: 'reading', title: 'Reading list', url: 'https://example.com/reading' },
      ],
    });
    await setStored(control, {
      activeSession: { id: 'store', profileId: 'writing', startedAt: Date.now() - 47 * 60_000 },
      tourOffered: true,
    });
    /** Writing's YouTube toggles all off, or back as the starter profile has them. */
    const starting = (await stored(control)).profiles ?? starterProfiles;
    const youtubeToggles = async (on: boolean) => {
      const off = Object.fromEntries(youtube.toggles.map((toggle) => [toggle.id, false]));
      const allOff = (p: Profile): Profile => ({
        ...p,
        sites: p.sites.map((site) => (site.recipeId === 'youtube' ? { ...site, toggles: off } : site)),
      });
      await setStored(control, { profiles: on ? starting : starting.map((p) => (p.id === 'writing' ? allOff(p) : p)) });
    };

    // Captured at twice the size, so they stay sharp when composed.
    const page = await t.browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    const settings = `chrome-extension://${t.extensionId}/options.html`;

    // YouTube's preview drawing on a video page, untouched and then tamed.
    for (const on of [false, true]) {
      await youtubeToggles(on);
      await page.goto(settings);
      const preview = await page.waitForSelector('.preview:has(button[aria-label="Show YouTube Video preview"])');
      await preview!.$eval('button[aria-label="Show YouTube Video preview"]', (button) =>
        (button as HTMLElement).click(),
      );
      await preview!.scrollIntoView();
      // Hidden parts fade out.
      await pause(1500);
      shots[on ? 'videoTamed' : 'video'] = asImage(await (await preview!.$('.frame'))!.screenshot());
    }

    // The top of the settings page: the profiles, then the four levels.
    await page.goto(settings);
    await page.waitForSelector('dl.legend');
    const levels = await page.evaluate(() => {
      const tabs = document.querySelector('[role="tablist"][aria-label="Profiles"]')!.getBoundingClientRect();
      const key = document.querySelector('dl.legend')!.getBoundingClientRect();
      return { x: key.left - 16, y: tabs.top - 16, width: key.width + 32, height: key.bottom - tabs.top + 32 };
    });
    shots.levels = asImage(await page.screenshot({ clip: levels }));

    // YouTube's card in the settings, with its page rule for Shorts (from the starter profile).
    const card = await page.waitForSelector('ul.sites > li:has(button[aria-label="Show YouTube Video preview"])');
    await card!.scrollIntoView();
    await pause(1500);
    shots.youtubeCard = asImage(await card!.screenshot());

    // The redirect page, on a visit to X.
    await page.goto(urls.x);
    await page.waitForSelector('.badge');
    // The tests serve X from x.test; the real page shows the real address.
    await page.$eval('.destination', (el) => (el.textContent = 'x.com/home'));
    await pause(1000);
    const redirect = await page.evaluate(() => {
      const card = document.querySelector('.card.stage')!.getBoundingClientRect();
      const brand = document.querySelector('.brand')!.getBoundingClientRect();
      return { x: card.left - 28, y: brand.top - 28, width: card.width + 56, height: card.bottom - brand.top + 56 };
    });
    shots.redirect = asImage(await page.screenshot({ clip: redirect }));

    // The popup on YouTube. Chrome sizes a popup itself, so it's captured as it is, down to the
    // last toggle that fits; the composed shot fades it out there.
    const tab = await t.browser.newPage();
    await tab.goto(urls.youtube);
    const popup = await openPopup(t, tab);
    await pause(500);
    const cut = await popup.evaluate(() => {
      const rows = [...document.querySelectorAll('main button[role="switch"]')];
      const fits = rows.map((row) => row.getBoundingClientRect()).filter((box) => box.bottom <= window.innerHeight);
      return { width: document.documentElement.clientWidth, height: Math.ceil(fits.at(-1)?.bottom ?? 0) + 6 };
    });
    shots.popup = asImage(await popup.screenshot({ clip: { x: 0, y: 0, ...cut } }));
  } finally {
    await t.close();
  }
  return shots;
}

// The extension's night sky (assets/theme.css), filling the whole image.
const style = `
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body {
    background:
      radial-gradient(1px 1px at 12% 18%, rgb(243 240 230 / 0.55), transparent),
      radial-gradient(1px 1px at 27% 64%, rgb(243 240 230 / 0.35), transparent),
      radial-gradient(1.5px 1.5px at 41% 31%, rgb(220 228 255 / 0.5), transparent),
      radial-gradient(1px 1px at 58% 12%, rgb(243 240 230 / 0.4), transparent),
      radial-gradient(1px 1px at 66% 47%, rgb(220 228 255 / 0.3), transparent),
      radial-gradient(1.5px 1.5px at 79% 22%, rgb(243 240 230 / 0.45), transparent),
      radial-gradient(1px 1px at 88% 71%, rgb(220 228 255 / 0.35), transparent),
      radial-gradient(1px 1px at 8% 83%, rgb(243 240 230 / 0.3), transparent),
      radial-gradient(120% 60% at 50% 115%, rgb(120 92 150 / 0.32), transparent 70%),
      linear-gradient(#0b1020, #0d1226 60%, #15142a);
    color: #f3f0e6;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .brand { font: 600 15px ui-monospace, 'SF Mono', Menlo, monospace; letter-spacing: 0.22em; text-transform: uppercase; }
  .brand span { color: #f5c86b; }
  h1 { font-weight: 400; font-size: 44px; line-height: 1.12; letter-spacing: -0.01em; margin: 22px 0 18px; }
  p { color: #a9b1cc; font-size: 20px; line-height: 1.5; margin: 0; }
  img { display: block; border-radius: 10px; box-shadow: 0 24px 60px rgb(0 0 0 / 0.45); }
  .split { display: flex; align-items: center; gap: 56px; height: 100%; padding: 0 72px; }
  .text { flex: 0 0 400px; }
  .shot { flex: 1; display: flex; justify-content: center; }
  .fade { position: relative; }
  .fade::after {
    content: ''; position: absolute; inset: auto 0 0; height: 90px; border-radius: 0 0 10px 10px;
    background: linear-gradient(transparent, #110f24);
  }
  .hero { height: 100%; padding: 0 64px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
  .hero h1 { margin: 18px 0 14px; }
  .pair { display: flex; gap: 32px; margin-top: 48px; }
  .pair figure { margin: 0; flex: 1; }
  .pair img { width: 100%; }
  figcaption {
    font: 600 13px ui-monospace, 'SF Mono', Menlo, monospace; letter-spacing: 0.2em; text-transform: uppercase;
    color: #7c84a3; margin-bottom: 12px; text-align: left;
  }
  figcaption.tamed { color: #f5c86b; }
  .tile { height: 100%; display: flex; align-items: center; gap: 22px; padding: 0 36px; }
  .tile svg { flex: 0 0 132px; height: 132px; margin: -16px; }
  .tile h1 { font-size: 40px; margin: 0 0 6px; }
  .tile p { font-size: 17px; line-height: 1.35; }
`;

const brand = `<div class="brand"><span>✦</span> Lock In</div>`;

function split(title: string, text: string, image: string, width: number, fade = false) {
  return `<div class="split">
    <div class="text">${brand}<h1>${title}</h1><p>${text}</p></div>
    <div class="shot"><div class="${fade ? 'fade' : ''}"><img src="${image}" style="width: ${width}px"></div></div>
  </div>`;
}

it('makes the store listing images', async () => {
  const shots = await capture();
  const icon = await readFile(join(import.meta.dirname, '../icon/icon.svg'), 'utf8');

  // Named in the order they go in the listing.
  const images: Record<string, { size: [number, number]; body: string }> = {
    '1-tame': {
      size: [1280, 800],
      body: `<div class="hero">${brand}
        <h1>Tame distracting sites instead of blocking them</h1>
        <p>Hide the feeds, Shorts and recommendations during focus sessions. The rest of the site still works.</p>
        <div class="pair">
          <figure><figcaption>Before</figcaption><img src="${shots.video}"></figure>
          <figure><figcaption class="tamed">✦ Tamed</figcaption><img src="${shots.videoTamed}"></figure>
        </div>
      </div>`,
    },
    '2-popup': {
      size: [1280, 800],
      body: split(
        'Right there in your toolbar',
        "See your session, and choose what's hidden on the site you're on. Changes show on the page straight away.",
        shots.popup!,
        390,
        true,
      ),
    },
    '3-redirect': {
      size: [1280, 800],
      body: split(
        'A pause before the scroll',
        'Redirected sites ask for five minutes of focus first, with your own if-then plan and links. Still need it after? Take a few minutes.',
        shots.redirect!,
        480,
      ),
    },
    '4-levels': {
      size: [1280, 800],
      body: split(
        'Four levels, a profile for each kind of focus',
        'Every site is allowed, tamed, redirected or restricted, chosen per profile. Writing and winding down can want different things.',
        shots.levels!,
        632,
      ),
    },
    '5-rules': {
      size: [1280, 800],
      body: split(
        'Choose exactly what goes',
        'Pick what each site hides, and give part of a site its own level, like redirecting YouTube Shorts while the rest stays tamed.',
        shots.youtubeCard!,
        560,
      ),
    },
    'promo-tile': {
      size: [440, 280],
      body: `<div class="tile">${icon}<div><h1>Lock In</h1><p>Tame distracting sites during focus sessions.</p></div></div>`,
    },
  };

  await mkdir(out, { recursive: true });
  const t = await launch();
  try {
    const page: Page = await t.browser.newPage();
    for (const [name, { size, body }] of Object.entries(images)) {
      await page.setViewport({ width: size[0], height: size[1] });
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${style}</style><body>${body}</body>`);
      await page.screenshot({ path: join(out, `lock-in-${name}.png`) as `${string}.png` });
    }
  } finally {
    await t.close();
  }
}, 120_000);
