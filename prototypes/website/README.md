# Website mock-ups

HTML mock-ups for the Phase 6 website (PLAN §10). They aren't the site; they're three directions to react to before building it in `apps/website`. All three share the apps' night-sky colors, HUD frames and the real copy, and each one respects reduced motion.

**To view them**, start the static server from the repo root and open <http://localhost:4321>:

```bash
pnpm --filter @lock-in/desktop exec vite ../../prototypes/website --port 4321
```

- `index.html`: the three side by side.
- `a-the-switch.html`: PLAN §10 as written. Distractions jitter around the edges of a light-polluted sky, and one big Lock In switch in the middle springs them away, clears the sky and draws a constellation. Scrolling past the hero flips it too. Below, the four levels follow the step in the middle of the screen on a made-up video site, the redirect page counts down for real, small skies show stars, constellations, planets and satellites, and research findings are labelled by strength.
- `b-observatory.html`: after `apps/website/references/wow-crazy-landing-page.jpg`. A fixed frame with a huge gradient wordmark over drifting nebulae, readouts in the corners, and a constellation along the bottom as the navigation.
- `c-drift.html`: scrolling flies forward through floating distractions that puff out as they pass, into a clear sky; then glass cards that tilt under the pointer and a try-it demo of the four levels.
- `shared/theme.css`: colors, frames, buttons and readouts from the apps' `theme.css`.
- `shared/sky.js`: the canvas sky. Stars by brightness, the Milky Way, a constellation that draws itself, shooting stars, and `haze` for light pollution, from an orange city glow (1) to a clear sky (0).

Motion follows the Open Design skills' craft rules (`animation-discipline`, `anti-ai-slop`, `emilkowalski-motion`): transform and opacity only, one set of easing curves, and no flashing.
