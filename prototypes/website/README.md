# Website mock-ups

HTML mock-ups for the Phase 6 website (PLAN §10). They aren't the site; they were directions to react to. D was picked and built into `apps/website`. All three share the apps' night-sky colors, HUD frames and the real copy, and each one respects reduced motion.

**To view them**, start the static server from the repo root and open <http://localhost:4321>:

```bash
pnpm --filter @lock-in/desktop exec vite ../../prototypes/website --port 4321
```

- `index.html`: the three side by side.
- `a-the-switch.html`: PLAN §10 as written. Distractions jitter around the edges of a light-polluted sky, and one big Lock In switch in the middle springs them away, clears the sky and draws a constellation. Scrolling past the hero flips it too. Below, the four levels follow the step in the middle of the screen on a made-up video site, the redirect page counts down for real, small skies show stars, constellations, planets and satellites, and research findings are labelled by strength.
- `b-observatory.html`: after `apps/website/references/wow-crazy-landing-page.jpg`. A fixed frame with a huge gradient wordmark over drifting nebulae, readouts in the corners, and a constellation along the bottom as the navigation.
- `c-drift.html`: scrolling flies forward through floating distractions that puff out as they pass, into a clear sky; then glass cards that tilt under the pointer and a try-it demo of the four levels.
- `d-together.html`: the three mixed, as picked after the first look. B's frame, corner readouts and constellation navigation, with A's headline over B's distractions; C's Tame and Install sections and its tilting glass on every card; A's fade-in; and scrolling past the hero locks in once. Locking in fades the distractions away where they are, and a clear sky shows two planets and satellites gliding across it. A Satellites section has a live demo: launch a thought, end the session, and review what came back.
- `shared/theme.css`: colors, frames, buttons and readouts from the apps' `theme.css`.
- `shared/sky.js`: the canvas sky. Stars by brightness, the Milky Way, a constellation that draws itself, shooting stars, and `haze` for light pollution, from a polluted glow (1) to a clear sky (0). `city` picks how the pollution looks: a sunset-like glow (0) or city lights (1), a skyline with lit windows under a dome of orange light. D has a switch at the top to compare them.

Motion follows the Open Design skills' craft rules (`animation-discipline`, `anti-ai-slop`, `emilkowalski-motion`): transform and opacity only, one set of easing curves, and no flashing.
