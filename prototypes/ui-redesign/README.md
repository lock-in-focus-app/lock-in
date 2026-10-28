# UI redesign prototypes

HTML prototypes for the Phase 5 UI redesign (see `PLAN.md`). They aren't part of the app. **C, Observatory HUD, is the chosen direction**; A and B stay here for reference, to borrow parts from later.

**To view them**, they need a server, since `file://` pages open as static snapshots in the browser pane. With the desktop Vite dev server running on port 1420 (`pnpm --filter @lock-in/desktop dev`), open `http://localhost:1420/@fs/<path to this repo>/prototypes/ui-redesign/index.html`.

`index.html` shows all three at the real 400×600 window size, with one switch for Sky, Session, Explore and Your week (and Profiles and Settings, which only C has). Each frame is also clickable on its own: start a session from a profile, end it, open the report, explore (Esc to leave).

- `a-nebula-glass.html`: dark smoked glass, each card's star color bleeding from behind it, one floating console with the satellite box above an icon toolbar, tiny corner stats.
- `b-bento-drift.html`: frosted bento tiles that float up in turn, a date-block header, one accent tile in a star color, this-week-against-last hatched bars and segmented profile bars.
- `c-observatory-hud.html`: hairline frames with corner ticks, small mono readouts, a ruler for the session's time, corner readouts while exploring, and Profiles and Settings pages.
- `sky.js`: a small canvas sky standing in for `NightSky.vue` (stars, last week's constellation, a ringed planet, satellites, nebula glow), easing between states, still with reduced motion.
- `data.js`: the shared, realistic content (starter profiles, a Deep Work session, the report for Oct 19–25) and a dot-chart helper.

Below the frames, `index.html` has a checklist of the changes made to make the prototypes easier to use (ticks are saved in that browser only).
