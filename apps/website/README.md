# Lock In website

The product website: the home page, Why it works (the research behind the features, from PLAN §12) and Privacy (from `PRIVACY.md`). Built with Nuxt and prerendered to static files, served by a Cloudflare Worker with no server code.

The design came from the mock-ups in `prototypes/website` (D, "Together").

## Develop

From the repository root:

```bash
pnpm dev:website
```

## How it fits together

- `app/layouts/default.vue`: everything around the pages: the canvas sky, the frame and its corner readouts, the constellation navigator, and the scroller the sections sit in. Each section with a `data-name` becomes a star on the navigator.
- `app/utils/sky.js`: the canvas sky (stars, the Milky Way, the week's constellation, shooting stars, and light pollution as a sunset glow or city lights).
- `app/composables/useLock.ts`: whether you're locked in, shared by the hero's switch, the session readout and the sky. Scrolling past the hero, or opening a reading page, locks in once by itself.
- `app/components/home/`: the home page's sections. Their demos (the four levels, the redirect page's countdown, satellites) are made up and run in the page only.
- `app/assets/css/`: the styles, in cascade order (see `nuxt.config.ts`).

Everything respects `prefers-reduced-motion`: the sky stops moving and the animations end at once.

## Build

```bash
pnpm --filter @lock-in/website generate
```

This writes the static site to `.output/public`, including a `404.html` for unknown addresses.

## Deploy (Cloudflare Workers)

`wrangler.jsonc` describes a Worker that only serves the files in `.output/public` (static assets, no script) and answers unknown addresses with the 404 page.

To deploy from GitHub with Workers Builds, in the Cloudflare dashboard go to **Workers & Pages › Create › Import a repository**, pick this repository, and set:

- **Root directory:** `apps/website`
- **Build command:** `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @lock-in/website generate`
- **Deploy command:** `npx wrangler deploy` (the default)
- **Build watch paths** (optional, so app-only changes don't redeploy the site): `apps/website/*`, `pnpm-lock.yaml`

The build needs Node 22 or later. If the first build uses an older one, add a `NODE_VERSION` variable set to `22` under the Worker's build settings.

Then add the domain under the Worker's **Settings › Domains & Routes › Custom domain**.
