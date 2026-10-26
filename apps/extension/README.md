# Lock In — browser extension

Tames, blocks, or redirects distracting sites during focus sessions. It works on its own; the desktop app plugs in later.

## Develop

From the repo root:

```bash
pnpm dev:extension          # Chrome-family, with hot reload
pnpm dev:extension:firefox  # Firefox-family
```

Or build and load it by hand:

1. `pnpm --filter @lock-in/extension build`
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `apps/extension/.output/chrome-mv3`.

## Test

```bash
pnpm test:e2e
```

This builds the extension and runs the browser tests in `e2e/` against Chrome for Testing. The first time, download that browser with `pnpm --filter @lock-in/extension exec puppeteer browsers install chrome`.

The tests never touch the real sites. They load a copy of the build with its site patterns rewritten to `.test` domains (`www.reddit.test`, `x.test`), which Chrome resolves to a local server serving the pages in `e2e/fixtures/`.

## How it works

- `utils/state.ts`: the active session, profiles, redirect visits and your own quotes, kept in `storage.local` and shared by every part of the extension.
- `utils/actions.ts`: every change to that state goes through here, so the desktop app can take over later without the UI changing.
- `entrypoints/popup/`: start and end sessions, set the current site's level for a profile between sessions, and change its toggles for this session or for a profile.
- `entrypoints/options/`: the settings page. Create, rename, duplicate, reorder and delete profiles; set each site to Allowed, Tamed, Redirected or Restricted; choose how redirected sites behave; and manage your links and quotes.
- `entrypoints/content.ts`: runs on recipe sites at `document_start` and injects the recipe CSS for the active session. It updates live when a session starts or ends. It also catches single-page apps moving onto a redirected or restricted page (e.g. clicking a Short on YouTube), which the browser's redirect rules can't see. On redirected sites it also handles tabs that were already open, or whose pass ran out: it pauses them with an overlay (`utils/pauseOverlay.ts`) or sends them back, depending on the profile.
- `entrypoints/background.ts` and `utils/redirects.ts`: turn the session's *Redirected* and *Restricted* sites into `declarativeNetRequest` rules, so the browser itself sends those visits to the redirect page with no extension code running per request. The rules are rebuilt when the session or profiles change and when a pass runs out. The redirect page is web-accessible from every site (Chrome only redirects to it if the page a link was on may load it), with `use_dynamic_url` so websites can't load it to detect Lock In.
- `entrypoints/redirect/`: where redirected visits land. It counts today's attempts, asks "what brought you here?", and shows one of the profile's pages at random: a quote, one of your links, or the "I'm stuck" page, each with a "Still need it?" link to the intention gate (a countdown, then a pass to that one site). Profiles can also send visits straight to the gate. Restricted sites get a page with no way through.
- Recipes live in `packages/recipes` and quotes in `packages/quotes`. While a site is tamed, the content script keeps the page's path in `data-lock-in-path` on `<html>`, so recipe selectors can target some pages only (e.g. `html[data-lock-in-path^="/explore"] main`). The logic for matching, CSS, redirects, passes and settings lives in `packages/core`.
