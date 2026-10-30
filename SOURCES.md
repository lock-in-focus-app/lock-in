# Building the Seiza extension from source

For Firefox Add-ons reviewers, and anyone checking a release against its source. This zip has the parts of the repository the extension is built from: `apps/extension`, `packages/` and the workspace files. The full repository is at <https://github.com/seiza-app/seiza>.

## Needs

- Node.js 24 (22 or later works)
- pnpm 11.25.0. With Corepack: `corepack enable`, and `package.json` picks the version.
- macOS or Linux

## Build

From the folder this file is in:

```bash
pnpm install --frozen-lockfile
pnpm --filter @lock-in/extension build:firefox
```

The built extension is in `apps/extension/.output/firefox-mv2`, and matches the submitted one file for file.

## What's in it

- `apps/extension`: the extension, built with [WXT](https://wxt.dev) and Vue. `wxt.config.ts` writes the manifest.
- `packages/core`: the logic shared with the desktop app (matching sites, recipe CSS, redirects, passes). `src/generated` holds TypeScript types generated from the desktop app's Rust code.
- `packages/recipes`: the CSS selectors that tame each built-in site, as JSON.
- `packages/quotes`: bundled public-domain quotes. The extension doesn't use them; they're in the workspace the build installs.

The minified chunk `_plugin-vue_export-helper` is Vue's own runtime, where web-ext lint warns about `innerHTML`. Seiza's code doesn't set `innerHTML`.
