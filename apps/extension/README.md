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

- `utils/state.ts`: the active session, profiles and intention-gate visits, kept in `storage.local` and shared by every part of the extension.
- `utils/actions.ts`: every change to that state goes through here, so the desktop app can take over later without the UI changing.
- `entrypoints/popup/`: start and end sessions, and change a site's toggles for this session or for a profile.
- `entrypoints/content.ts`: runs on recipe sites at `document_start` and injects the recipe CSS for the active session. It updates live when a session starts or ends.
- `entrypoints/background.ts` and `utils/redirects.ts`: turn the session's *Redirected* sites into `declarativeNetRequest` rules, so the browser itself sends those visits to the gate with no extension code running per request. The rules are rebuilt when the session or profiles change and when a pass runs out.
- `entrypoints/gate/`: the intention gate. It asks what you came for, counts today's attempts, holds Continue behind a countdown, and then gives that one site a 5-minute pass.
- Recipes live in `packages/recipes`, and the logic for matching, CSS, redirects and passes lives in `packages/core`.
