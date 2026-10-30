# ✦ Lock In

A free, open-source focus app. Social media is light pollution: when you lock in, the noise fades and you can finally see the stars.

> **Status:** early development. The browser extension works on its own today (sessions, profiles, recipes for eight sites, page rules and redirects); the desktop app comes next. See [PLAN.md](PLAN.md) for the full roadmap.

## Tame, don't just block

Most blockers treat a site as all or nothing. Lock In gives every site one of four levels, chosen per session profile:

| Level | What happens |
|---|---|
| **Allowed** | Nothing changes. |
| **Tamed** | The site still works, but the distracting parts are hidden: feeds, trending, suggested and promoted posts. Optionally grayscale. |
| **Redirected** | Visits go to a Lock In page instead: a quote, one of your own links, or a 2-minute unstick. To get through anyway, the intention gate asks what you came for, holds Continue for a few seconds, then gives you a few minutes on that site. |
| **Restricted** | Blocked, with no way through until the session ends. |

**Page rules** give part of a site its own level, like redirecting YouTube Shorts while the rest of YouTube is tamed, or allowing `reddit.com/r/writing` while the rest of Reddit is redirected.

What "tamed" means for a site is a **recipe**: a small JSON file of toggles, each mapped to CSS selectors. There are built-in recipes for Reddit, YouTube, X, Instagram, TikTok, Facebook, LinkedIn, Pinterest, Twitch, Threads and Bluesky. You can flip toggles from the extension popup for one session or save them to a profile.

Lock In has no accounts and no telemetry. Everything stays on your device.

## What's here

```
apps/
  extension/   Browser extension (WXT + Vue). Chrome, Brave, Edge, Arc, Firefox, Zen.
  desktop/     Desktop app (Tauri 2 + Vue). Scaffolded; not functional yet.
  website/     Product website (Nuxt). Scaffolded.
packages/
  core/        Shared types and logic: matching, recipes, profiles, sessions.
  recipes/     Built-in site recipes.
  quotes/      Bundled quotes for the quote card.
```

## Getting started

You'll need Node 22 or newer and pnpm (`corepack enable` sets it up).

```bash
pnpm install
pnpm dev:extension
```

`pnpm dev:extension` opens a browser with the extension loaded and reloads it as you edit. Use `pnpm dev:extension:firefox` for Firefox. To load a build by hand instead, see [apps/extension/README.md](apps/extension/README.md).

Other useful commands:

```bash
pnpm test          # unit tests
pnpm test:e2e      # browser tests for the extension (see apps/extension/README.md)
pnpm typecheck
pnpm lint          # ESLint
pnpm format        # Prettier (pnpm format:check only reports)
pnpm build
```

The desktop app also needs the [Rust toolchain](https://rustup.rs) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Run it with `pnpm dev:desktop`.

## Contributing

Recipes break when sites change their HTML, so fixes to the selectors in `packages/recipes` are especially welcome. Each recipe is plain JSON, and `pnpm test` checks that every selector is safe to inject.

Before opening a pull request, run `pnpm format`, `pnpm lint` and `pnpm test`; CI checks all three.

## License

[AGPL-3.0](LICENSE). You're free to use, study, change and share Lock In. If you run a modified version for other people, including as a hosted service, you must share your changes under the same license.
