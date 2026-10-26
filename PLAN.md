# Lock In — Product & Build Plan

> **Status:** plan approved, Oct 26 2026. Next: scaffold the pnpm workspace (§8), then start Phase 1.

## Context

Existing focus apps each get part of the way there:
- **Freedom**: good allow/block control, but it's heavy, and key features sit behind a paywall that may keep growing.
- **Focus Friend**: a fun reward loop, but it's phone-only and blocks everything.
- **SocialFocus**: hides distracting parts of social sites, but you have to toggle it by hand every time.

**Lock In** is a free-forever, open-source (**AGPL-3.0**) desktop focus app plus browser extension. It lets you:
- block, *tame*, or allow each site per session
- redirect distractions somewhere useful
- park distracting thoughts for later
- reward focus with a night sky that fills with stars

**Theme:** social media is *light pollution*. When you lock in, the noise fades and you can finally see the stars. The app, the reward system and the website all share this theme.

**Principles:**
- Lightweight and battery-friendly
- Private: no account, no telemetry, local-first
- Every default is editable

**Out of scope for now:** mobile apps. Revisit later; iOS blocking requires a paid Apple Developer account plus Apple's Family Controls approval, and AltStore/free signing can't use those APIs.

---

## 1. Core idea: "Tame, don't just block"

Each site has one of three levels, set per session profile:

| Level | What happens | Example |
|---|---|---|
| **Allowed** | Normal | Google Docs, Wikipedia |
| **Tamed** | The site works, but feeds, recommendations and Shorts are hidden; can be grayscale | Reddit threads and search work, the home feed is gone |
| **Redirected** | Sent to a redirect destination (§3) | x.com → intention gate |

Paths can override their site (e.g. `reddit.com/r/writing` allowed, `/r/all` redirected).

### Site Recipes (JSON) + live visual editor
A **recipe** defines what "tamed" means for one site: a list of toggles, each mapped to CSS selectors and effects. Built-in recipes cover Reddit, YouTube, X, Instagram, TikTok, Facebook and LinkedIn. Users can edit them or create their own, and the community can contribute fixes when sites change their HTML.

```json
{
  "id": "reddit",
  "match": ["*://*.reddit.com/*"],
  "toggles": [
    { "id": "hideHomeFeed", "label": "Hide home feed", "selectors": ["shreddit-feed"], "paths": ["/", "/r/all", "/r/popular"], "default": true },
    { "id": "hideSidebarRecs", "label": "Hide recommended communities", "selectors": ["#right-sidebar-container"] },
    { "id": "grayscale", "label": "Grayscale", "effect": "grayscale" }
  ]
}
```
(The selectors above are illustrative. The real ones are written and tested against the live sites in Phase 1.)

**The editor shows a version of the actual site and animates every toggle:**
- **Preview mock**: each built-in recipe ships with a lightweight, stylized wireframe of the site, built as a Vue component. It is *our own drawing*, not copied site assets.
  - Each region of the mock is tagged with the toggle id it represents.
  - Flipping a toggle makes that region collapse with a quick, bouncy spring (scale + height + fade), and the rest of the page reflows smoothly (FLIP technique).
  - Grayscale cross-fades the whole mock.
  - Feedback is instant, with no page loads.
- **Live mode** (for custom recipes and sites without a mock): the extension opens the real site with a small floating panel. Toggles apply to the real page instantly with the same animation. An **element picker**, like uBlock's "zapper", lets you hover → click to hide something, and it writes the selector into the recipe for you.
- **Animation implementation:** native CSS spring easing (`linear()` easing curves) + Vue `<Transition>`/`<TransitionGroup>`, with no animation library, to stay lightweight. Animations are disabled under `prefers-reduced-motion`.

### Session Profiles (fully user-managed)
A profile bundles:
- site levels + recipe toggle overrides
- app rules
- strictness
- timer settings
- redirect destinations

You can create, edit, duplicate, delete, reorder, and import/export (JSON) profiles. The app ships with **starter profiles that show what's possible**. They're ordinary editable profiles, and "Reset starter profiles" restores them:
- *Writing*: Reddit and YouTube tamed + grayscale, X redirected, Discord closed
- *Deep Work*: all social redirected, chat apps closed
- *Wind Down*: YouTube tamed (no Shorts or recommendations), nothing else

---

## 2. Sessions & timer

### Strictness (chosen per profile, adjustable per session)
- **Gentle**: a pause screen, then you can continue
- **Medium**: to end early, type a random string (Cold Turkey-style)
- **Hard**: can't end before the timer runs out. You get **emergency passes** instead (default 2 per week, configurable).

### The "quiet timer" (Pomodoro that doesn't cut you off)
The timer is a *starting ramp*, not a cage.
- **When it ends, it can stay silent.** The end-of-timer behavior is per profile:
  - *Silent* (default for Writing): **nothing happens at all**. No notification, sound, or menu-bar change.
  - *Gentle*: soft notification
  - *Alert*: sound + notification
- **"Show time since done" setting** (off by default): when on, a finished timer shows "Done · 37 min ago" and keeps counting up, so you can see how much extra you did. When off, it simply shows "Done".
- **Secret overtime bonus:** overtime is always tracked, whichever setting you choose. Minutes after the timer ends count **1.5×**. This is never announced. It shows up only as that session's star burning noticeably brighter in your sky, a little discovery for later.
- **Anti-gaming:** a session ends when you stop it, or automatically after N minutes of system idle (no keyboard or mouse). The idle tail isn't counted, so a forgotten timer doesn't farm overtime.

---

## 3. Redirect destinations (handled by the extension)

When a site is *Redirected*, the extension intercepts the navigation and sends you to one of the destinations below. Each profile chooses which ones it uses; if several are enabled, one is **picked at random by weight**. The pages are bundled inside the extension, so they load instantly and work offline.

1. **Intention gate**: "What did you come here for?" The **"Continue to site" button stays disabled behind a countdown**, so you have to pause and think. Three settings per profile keep it flexible without becoming a settings maze:
   - **Require a reason**: on/off. When on, you must type why you're going; when off, you just sit with the question during the countdown.
   - **Wait time**: either *fixed* (e.g. 10–15s) or *escalating* (starts at a few seconds and grows with each attempt at that site today, capped).
   - **When the pass expires**: you get a time-boxed pass (default 5 min) to *that site only*. When it runs out:
     - *Nothing*: the tab stays as it is.
     - *Pause* (default): the tab is covered by a dim overlay with a "Still need this?" button, which leads back to the intention gate. Reference tabs stay where they are.
     - *Auto-redirect*: the tab is sent back to the redirect page.
   - Typed reasons are logged for insights.
2. **Quote card**: a random quote from the bundled pack plus your own quotes.
3. **Productive URL**: one of your own links, such as your draft doc, to-do list, Anki or reading list.
4. **"I'm stuck" page**: a 2-minute structured unstick (rubber-duck prompt, break the task down, stretch, breathe).

Every redirect page shows:
- the **attempt counter**: "6th try at Reddit today"
- the **one-tap "why?"**: bored / stuck / tired / curious
- a **Satellites quick-capture box** (§4)

**Quotes & privacy:** the bundled and custom quote packs are the default. Optionally, the extension can fetch a *batch* (~50) from a public quote API **once a day** in the background and cache it. That way no request is ever tied to a specific redirect, and quotes still work offline. Redirect events (site, time, attempt #, why-tap, intention text) are sent to the desktop app over Native Messaging for stats and insights. The quotes themselves never need to make that round trip.

---

## 4. Satellites (thoughts for later)

**Problem:** mid-focus thoughts like "I should check this real quick" or "don't want to forget this" turn into distractions.

**Satellites** let you launch the thought into orbit, and it comes back when you're done.

To make the name instantly clear:
- It's always shown with its subtitle: **"Satellites · thoughts for later"**.
- The input placeholder reads *"Distracting thought? Launch it — it'll come back after your session."*
- On first use, a one-line tooltip with a tiny animation shows the thought orbiting the session timer.

**Capture from anywhere:**
- a global hotkey (opens a tiny spotlight-style box)
- the menu-bar icon
- the extension popup
- every redirect page

**Return:** when a session ends, you see "3 satellites came back". Review them as a checklist: done / snooze to the next break / turn into a task / delete.

Satellites also count in insights, e.g. "You parked 12 thoughts this week instead of acting on them."

---

## 5. Rewards: the night sky
- **Every session adds a star.** Longer sessions make bigger stars; overtime makes them secretly brighter (§2).
- **Streaks connect stars into constellations.** A week of streak days draws one, and you can name it.
- **Light pollution:** outside a session, the sky is washed out by a faint glow and haze. When you lock in, the pollution fades away and the sky is crisp for the whole session, while your new star forms. This is the brand metaphor made playable.
- **"View sky" toggle:** you can always switch to a clear view to explore, name and admire your constellations, even outside a session. The pollution is mood, not a lock.
- *Suggestions to consider:*
  - **Afterglow:** after a session ends, the sky stays clear for a while (e.g. ~20% of the session length) before the haze creeps back in. This is a small reward for finishing.
  - **Shooting stars** for milestones such as a streak record, a personal-best session, or the first constellation of a month.
- **Your year becomes a sky:** zoom out to see months of constellations. Stats sit alongside: focus time, streaks, level, and the weekly report.
- **Architecture:** a reward engine emits plain events (minutes, overtime minutes, streak days, distractions resisted, satellites parked). The sky is one swappable renderer over those events, so the community can build other "worlds" later.

### Community sky (opt-in)
- A **"Share this constellation"** button sends **only the shape**:
  - normalized star positions
  - brightness, rounded into a few coarse levels so session lengths can't be inferred
  - optionally, a name
- **Nothing else is sent:** no stats, dates, timestamps, account, device ID or personal data. The share dialog says this plainly and shows the exact JSON being sent.
- The server doesn't log IP addresses. Names are optional and moderated before they appear.
- On the website, shared constellations are assembled into **community worlds**: a shared sky that anyone can explore.

## 6. Insights (weekly report)
- When you get distracted, broken down by time of day, site, and **why** ("You reach for Reddit when *stuck*, mostly 2–4pm").
- Intention-gate reasons, grouped.
- Satellites parked and their outcomes.
- Overtime and focus trends.
- Suggestions, e.g. "Try scheduling Deep Work before 2pm."

Insights are all computed locally.

## 7. Other features
- **Session suggestions from apps** (off by default): opening an app or site you've linked to a profile, e.g. Obsidian → *Writing*, shows a small prompt: "Obsidian opened — start *Writing*?" with three choices:
  - **Start**
  - **Not now**
  - **Snooze** for 30 min / 1 h / 3 h

  It never starts a session silently. Calendar-based suggestions come later.
- **App rules**: close or hide desktop apps (Discord, Steam, Slack) during a session.
- **Session intention + reflection**: a one-line goal at the start, "did you do it?" at the end.
- **Allowlist-only mode**: block everything except the listed sites.
- **Earn your scroll** (opt-in): focus time earns a guilt-free budget of tamed-site time.

---

## 8. Platform, architecture & setup

### Stack
- **Desktop:** **Tauri 2**. A small Rust core with a **Vue 3 + Vite + TypeScript** UI, where most of the code will live.
  - It's chosen for weight and battery: about 10 MB vs Electron's ~150 MB, using the system webview.
  - Native OS access (process events, idle time, global hotkeys, menu bar) runs in Rust.
  - Use plain Vue rather than Nuxt; SSR adds nothing in a desktop app.
- **Extension:** **WXT + Vue + TS**, Manifest V3. One codebase builds both **Chrome-family** (Chrome, Brave, Edge, Arc) and **Firefox-family** (Firefox, Zen). Safari is not planned for now.
- **Shared:** `packages/core` holds the TS types and JSON schemas for Profile, Recipe, Session, RewardEvent and Satellite, plus shared logic. The Rust side mirrors the types; generate them from Rust with `ts-rs`/`specta` so the two never drift.
- **Storage:** local SQLite in the desktop app; `storage.local` in the extension, mirrored from the app.
- **Link between the two:** browser **Native Messaging**. The desktop app is the source of truth for the active session; the extension applies it and reports events back. **The extension is also a first-class standalone product**: it runs sessions, profiles, recipes and redirects entirely on its own, so people can install just the extension. The desktop app adds app blocking, stronger enforcement, Satellites hotkey, and the sky.

### Performance & battery budget (a hard requirement)
- **Menu-bar resident:** closing the window *destroys* the webview, so only the small Rust core stays running. The UI reopens on demand.
- **Event-driven, not polling:** use OS notifications for app launches (macOS `NSWorkspace` notifications; Windows and Linux equivalents) and system idle checks only during sessions. There are no timers ticking while idle.
- **Extension:**
  - URL matching uses `declarativeNetRequest`, which the browser does natively, with no JS per request.
  - Recipes are injected as static CSS at `document_start`, so there's no flash and no layout-thrashing scripts.
  - MutationObservers are only added where a recipe truly needs them.
  - The MV3 service worker sleeps when idle.
- **Minimal dependencies:** no animation, UI-kit or charting libraries unless they earn their place. The sky is drawn on a single canvas.
- **Measure, don't guess:** track idle CPU, RAM with the window closed and open, and energy impact (Activity Monitor) in CI notes for each release.

### Repo layout (pnpm workspaces)
```
lock-in/
  apps/
    desktop/        # Tauri 2: src-tauri/ (Rust) + src/ (Vue 3 + Vite + TS)
    extension/      # WXT + Vue: background, content scripts, redirect/gate/stuck pages, recipe live mode
    website/        # Night-sky themed product site (later; Nuxt static is fine here)
    sync-server/    # Self-hostable Rust sync server (later)
  packages/
    core/           # Shared TS types, JSON schemas, session/reward logic
    recipes/        # Built-in site recipes (JSON) + preview mock components
    quotes/         # Bundled quote packs (JSON)
  LICENSE           # AGPL-3.0
  PLAN.md
  pnpm-workspace.yaml   # packages: ["apps/*", "packages/*"]
```

### Suggested scaffolding commands (for your initialization)
- Prerequisites: Node LTS, pnpm, the Rust toolchain via `rustup`, and the Xcode Command Line Tools.
- Root: `pnpm init`, then `pnpm-workspace.yaml` with `apps/*` and `packages/*`.
- Desktop: `pnpm create tauri-app` → name `desktop`, in `apps/`, frontend **Vue + TypeScript**, package manager pnpm.
- Extension: `pnpm dlx wxt@latest init apps/extension` → template **vue**, package manager pnpm.
- Packages: `packages/core` (plain TS package; the others depend on it via `workspace:*`). `recipes` and `quotes` start as JSON folders.

### Sync (later, optional, privacy-preserving)
- **Local-first always.** Every feature works with no account.
- **Self-hosted sync:** an open-source `sync-server` (Rust + SQLite, one Docker image).
  - Syncs profiles, recipes, satellites, stats and the sky.
  - **Live session sync:** start Deep Work on one computer and it starts everywhere (like Freedom, but yours).
  - **End-to-end encrypted:** the server only stores ciphertext.
- **Optional cheap hosted sync** (Obsidian Sync-style) for people who don't want to self-host. It's the same E2E server, so even the hosted version can't read anyone's data. No features are gated; paying only buys convenience.
- **AGPL fits this model:** anyone running a modified sync server for others must publish their changes. As the copyright holder, you can still run the hosted tier.

### Support the developer
- A small, quiet "Support Lock In" link appears only on the website and at the very bottom of Settings.
- No nags, popups or feature gates.

---

## 9. Roadmap

**Phase 0: Setup** (you scaffold)
- pnpm monorepo, AGPL-3.0 license, `packages/core` schemas, lint/format/test, CI.

**Phase 1: Extension MVP** *(replaces your manual SocialFocus toggling first)*
- Standalone: sessions run from the extension popup, with no desktop app needed (the app plugs in later via Native Messaging).
- Recipes for Reddit, YouTube and X with real tested selectors: tame, grayscale, redirect, path rules.
- Profiles: CRUD + starter profiles, manual start/stop.
- Redirect destinations: intention gate with countdown, quote card, productive URL, stuck page.
- Attempt counter + why-tap.
- Recipe editor with animated preview mocks.

**Phase 2: Desktop app (Tauri)**
- Menu-bar app, session engine, quiet timer + idle detection.
- Strictness levels + emergency passes.
- Native Messaging link + extension heartbeat: if the extension goes quiet during a session, warn → close that browser → count the session as broken, depending on strictness.
- App rules, SQLite.

**Phase 3: Satellites & insights**
- Global-hotkey capture and the post-session return.
- Weekly report.
- Session suggestions from apps.

**Phase 4: The night sky**
- Reward engine + sky renderer: light pollution outside sessions, a clear sky during them, the "View sky" toggle, constellations, secret overtime brightness.
- Streaks and levels.

**Phase 5: Polish & release**
- Recipe live mode + element picker.
- Remaining built-in recipes.
- Optional daily quote fetch.
- Export/import.
- Signed builds: macOS notarization requires a paid Apple account, while unsigned builds work with a Gatekeeper warning. Also publish to the Chrome Web Store and Firefox Add-ons.

**Phase 6: Website, community sky & sync**
- Marketing website (§10) + community-worlds gallery.
- Constellation sharing endpoint.
- Self-hostable sync server, then optionally the hosted tier.

---

## 10. Marketing website (Phase 6, to discuss in detail later)
- **Hero:** a light-polluted night sky. Around the edges, distractions crowd in: fake reels, tweet cards, notification badges, autoplaying thumbnails, all jittering and glowing. They're original mock UI, not real brand assets.
- **The toggle:** a single big **Lock In** toggle sits at the center. Flipping it pushes every distraction out past the edges with springy, staggered motion. The orange glow drains away, and a deep, clear sky full of stars fades in, ideally with a constellation drawing itself.
- **Design language everywhere: distracted vs. focused.**
  - *Distracted* states are noisy, saturated, cluttered and jittery.
  - *Focused* states are calm, dark, spacious and slow.
  - Animations, sections and even button hovers play on this contrast.
  - It respects `prefers-reduced-motion`.
- Also on the site: download links, the community sky (§5), how it works, privacy promises, and the quiet support link.

---

## 11. Verification (Phase 1–2)
- **Extension:** run `wxt dev` for Chrome and Firefox. In a *Writing* session:
  - the Reddit home feed is hidden while threads and search still work
  - grayscale is applied
  - x.com goes to the intention gate, whose Continue button counts down and grants a 5-minute pass that later expires
  - the attempt counter goes up
- End the session: everything returns to normal.
- **Recipe editor:** each toggle animates the preview mock instantly. Exported JSON matches the schema in `packages/core`.
- **Desktop:**
  - Starting a profile in the app updates the extension within ~1s.
  - Disabling the extension mid-session triggers the strictness response.
  - In *Silent* mode the timer ends with no visible change at all. With "Show time since done" on, it shows "Done · N min ago".
  - Overtime minutes are recorded either way.
  - Idle auto-ends the session without counting the idle tail.
  - Hard mode can't be ended without a pass.
- **Performance:** with the window closed, check idle CPU (~0%) and memory in Activity Monitor. Energy impact should be "Low".

---

## Sources
- Freedom: [free vs premium](https://support.freedom.to/en/articles/13764747-what-s-included-in-free-and-premium-plans), [features](https://api.freedom.to/features)
- Focus Friend: [App Store](https://apps.apple.com/US/app/id6742278016), [review](https://makeheadway.com/blog/focus-friend-app-review/)
- one sec (attempt counter, pause friction): [review](https://cellphoneplans.androidauthority.com/CellPhones/Apps/one-sec-app-review)
- Opal (focus score, mindful block screens, intentions): [the new Opal](https://opal.so/blog/introducing-the-new-opal), [review](https://makeheadway.com/blog/opal-app-review/)
- Cold Turkey (random-text unlock, Frozen Turkey): [TechRadar](https://www.techradar.com/reviews/cold-turkey)
- SocialFocus: [socialfocus.app](https://socialfocus.app/)
- Open-source prior art: [Focuser (Rust/Tauri)](https://github.com/aadeshrao123/Focuser/)
- iOS limits (deferred): [Screen Time API in 2026](https://dev.to/twillywill/the-ios-screen-time-api-in-2026-what-apples-docs-dont-tell-you-151e), [Personal Team can't use Family Controls](https://hsb.horse/en/blog/personal-team-family-controls-limitation/)
- Tauri 2: [roadmap / plugins](https://v2.tauri.app/blog/roadmap-to-tauri-2-0/)
