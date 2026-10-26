# ✦ Lock In

A free, open-source focus app. Social media is light pollution: when you lock in, the noise fades and you can finally see the stars.

> **Status:** early development. The browser extension works on its own today; the desktop app comes next. See [PLAN.md](PLAN.md) for the full roadmap.

## Tame, don't just block

Most blockers treat a site as all or nothing. Lock In gives every site one of three levels, chosen per session profile:

| Level | What happens |
|---|---|
| **Allowed** | Nothing changes. |
| **Tamed** | The site still works, but the distracting parts are hidden: feeds, trending, suggested and promoted posts. Optionally grayscale. |
| **Redirected** | Visits go to a Lock In page that asks what you came for, then lets you through for a few minutes if you still need it. |

What "tamed" means for a site is a **recipe**: a small JSON file of toggles, each mapped to CSS selectors. You can flip toggles from the extension popup for one session or save them to a profile.

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
  quotes/      Bundled quote packs (coming soon).
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
pnpm test        # unit tests
pnpm test:e2e    # browser tests for the extension (see apps/extension/README.md)
pnpm typecheck
pnpm build
```

The desktop app also needs the [Rust toolchain](https://rustup.rs) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Run it with `pnpm dev:desktop`.

## Contributing

Recipes break when sites change their HTML, so fixes to the selectors in `packages/recipes` are especially welcome. Each recipe is plain JSON, and `pnpm test` checks that every selector is safe to inject.

## License

[AGPL-3.0](LICENSE). You're free to use, study, change and share Lock In. If you run a modified version for other people, including as a hosted service, you must share your changes under the same license.
