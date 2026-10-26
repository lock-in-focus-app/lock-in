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

## How it works

- `utils/state.ts`: the active session and profiles, kept in `storage.local` and shared by every part of the extension.
- `entrypoints/popup/`: start and end sessions.
- `entrypoints/content.ts`: runs on recipe sites at `document_start` and injects the recipe CSS for the active session. It updates live when a session starts or ends.
- Recipes live in `packages/recipes`, and the logic that turns them into CSS lives in `packages/core`.
