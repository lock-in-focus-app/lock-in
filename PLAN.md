# Lock In — Product & Build Plan

> **Status:** Phase 1 built. The extension works on its own: sessions, profiles (with an editor), all four site levels with page rules, redirects with every destination, and recipes for Reddit, YouTube, X, Instagram, TikTok, Facebook, LinkedIn and Pinterest, each with an animated preview in Settings. Left before calling Phase 1 done: checking each recipe on the real site. Then Phase 2, the desktop app.

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

Each site has one of four levels, set per session profile:

| Level | What happens | Example |
|---|---|---|
| **Allowed** | Normal | Google Docs, Wikipedia |
| **Tamed** | The site works, but feeds, recommendations and Shorts are hidden; can be grayscale | Reddit threads and search work, the home feed is gone |
| **Redirected** | Sent to a redirect destination (§3) | x.com → intention gate |
| **Restricted** | Blocked outright: no countdown, no pass, no way through until the session ends | Reddit during an exam-prep session |

**Page rules** give part of a site its own level (e.g. `reddit.com/r/writing` allowed while the rest of Reddit is redirected, or YouTube tamed with `/shorts` redirected).
- **Matching:** `/` is the home page only; any other path also covers everything under it (`/r/writing` includes its posts, but not `/r/writingprompts`). `*` matches within one part of the path. Matching ignores case, and the most specific (longest) rule wins.
- **Why it matters for video:** a recipe can hide the links to Shorts and Reels, but hiding a playing video with CSS doesn't stop its sound. Redirecting `/shorts`, `/reels` or TikTok's For You page stops it properly.
- **Two ways in:** full page loads are caught by the browser's redirect rules (an allow rule ranks above a site redirect, longer paths first). Single-page apps like YouTube change pages without loading one, so the content script also checks each in-site navigation, using the event the browser fires on URL changes. It costs one comparison per click, only on recipe sites, with no polling.
- **Suggestions:** each recipe lists common pages (Shorts, Reels, Explore, For You…) offered as one-click "Redirect" buttons in settings while the rest of the site is open.

### Site Recipes (JSON) + live visual editor
A **recipe** defines what "tamed" means for one site: a list of toggles, each mapped to CSS selectors and effects. Built-in recipes cover Reddit, YouTube, X, Instagram, TikTok, Facebook, LinkedIn and Pinterest. Users can edit them or create their own, and the community can contribute fixes when sites change their HTML.

```json
{
  "id": "x",
  "name": "X",
  "matches": ["*://*.x.com/*", "*://*.twitter.com/*"],
  "source": "Where the selectors came from, with the license",
  "toggles": [
    { "id": "hideHomeTimeline", "label": "Hide home timeline", "selectors": ["html[data-lock-in-path=\"/home\"] [data-testid=\"primaryColumn\"] section > h1 + div[aria-label]"], "default": true },
    { "id": "hideWhoToFollow", "label": "Hide who to follow", "selectors": ["[data-testid=\"sidebarColumn\"] aside[role=\"complementary\"]"], "default": true },
    { "id": "grayscale", "label": "Grayscale", "effect": "grayscale", "default": false }
  ]
}
```

**How recipes are written:**
- **Plain CSS only.** Recipes are injected as one stylesheet at `document_start`, so there's no flash and no script running per element. Selectors are checked so they can't break out of the stylesheet.
- **Page-specific hiding.** CSS can't see the URL, so while a site is tamed the extension keeps the page's path on `<html data-lock-in-path="…">` and updates it as single-page apps navigate. A selector like `html[data-lock-in-path^="/explore"] main` hides something on some pages only.
- **Prefer stable hooks.** Use test ids, roles, `href`s and custom element names over generated class names (Facebook and Instagram change theirs constantly). Some selectors still rely on English labels (`aria-label="Explore"`), which is a known gap for other languages.
- **Credit sources.** Selectors adapted from open projects (UBlock-Filters-for-Social-Media, Control Panel for Twitter and Declutter Pinterest, all MIT; News Feed Eradicator, AGPL-3.0 like Lock In) are credited in the recipe's `source`. TikTok has no open list to draw on, so its recipe uses TikTok's own `data-e2e` test attributes and links.
- **Tested twice.** Browser tests check each recipe against a stand-in page for the site. Sites change their HTML without notice, so each recipe also needs checking on the real site before a release.

**The editor shows a version of the actual site and animates every toggle:**
- **Preview mock**: each built-in recipe ships with a lightweight, stylized wireframe of the site, built as a Vue component. It is *our own drawing*, not copied site assets. It sits above the site's toggles in Settings.
  - Each region of the mock is tagged with the toggle id it represents (`<MockRegion toggle="hideShorts">`).
  - Flipping a toggle makes that region collapse with a quick, bouncy spring (scale + height + fade), and the rest of the page reflows smoothly. The height animates through `grid-template-rows: 1fr → 0fr`, so the browser does the reflow and no FLIP script is needed.
  - Pointing at (or focusing) a toggle outlines its region. If the region is already hidden, it comes back as a faint dashed ghost, so you can see what the toggle takes away.
  - Sites can have several pages (YouTube: Home and Video); pointing at a toggle that only matters on another page switches to it.
  - Grayscale cross-fades the whole mock.
  - Feedback is instant, with no page loads.
  - Every built-in site has one (Pinterest also has a Pin page). A browser test fails if a recipe gains a toggle that isn't drawn. Custom recipes without a drawing just show their toggles.
- **Live mode** (for custom recipes and sites without a mock): the extension opens the real site with a small floating panel. Toggles apply to the real page instantly with the same animation. An **element picker**, like uBlock's "zapper", lets you hover → click to hide something, and it writes the selector into the recipe for you.
- **Animation implementation:** native CSS spring easing (`linear()` easing curves) and CSS transitions, with no animation library, to stay lightweight. Animations are disabled under `prefers-reduced-motion`.

### Session Profiles (fully user-managed)
A profile bundles:
- site levels + recipe toggle overrides
- app rules
- strictness
- timer settings
- redirect destinations

You can create, edit, duplicate, delete, reorder, and import/export (JSON) profiles. The app ships with **starter profiles that show what's possible**. They're ordinary editable profiles, and "Reset starter profiles" restores them:
- *Writing*: Reddit and YouTube tamed + grayscale (YouTube Shorts redirected); X, Instagram, TikTok and Facebook redirected; Discord closed
- *Deep Work*: all social redirected (with a quote or unstick page some of the time, and an escalating wait), chat apps closed
- *Wind Down*: Reddit, YouTube and Instagram tamed (no feeds or recommendations; Shorts and Reels redirected), nothing else

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
- **Secret overtime bonus:** overtime is always tracked, whichever setting you choose. Minutes after the timer ends count **1.5×**. This is never announced. It shows up only as that session's star twinkling a little brighter in your sky and as extra stardust (§5), a little discovery for later.
- **Anti-gaming:** a session ends when you stop it, or automatically after N minutes of system idle (no keyboard or mouse). The idle tail isn't counted, so a forgotten timer doesn't farm overtime.

---

## 3. Redirect destinations (handled by the extension)

When a site is *Redirected*, the extension intercepts the navigation and sends you to one of the destinations below. Each profile chooses which ones it uses; if several are enabled, one is **picked at random** (each equally likely for now; per-destination weights may come later). The pages are bundled inside the extension, so they load instantly and work offline.

The intention gate (1) is the way through, so Settings gives it its own section: a "Show the gate right away" switch decides whether visits can land straight on it, and the other pages (2–4) each link to it with "Still need it?". At least one page is picked, or the switch is on, so a visit always has somewhere to land.

Links to a redirected site can come from anywhere (a search result, a chat), and Chrome only redirects to an extension page if the page the visit came from may load it. So the redirect page is open to every site, with `use_dynamic_url` so websites can't load it directly to detect Lock In.

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
- a **Satellites quick-capture box** (§4, comes with Satellites in Phase 3)

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
- a global hotkey, **Alt+P** (Option+P on a Mac), which opens a tiny spotlight-style box. Return launches the thought and hands focus straight back to the app you were in; Escape or clicking elsewhere closes it. (Option+P normally types π, which Lock In takes over while it's running; the hotkey becomes changeable in Settings later.)
- the menu-bar icon
- the extension popup
- every redirect page

**Return:** nothing pops up when a session ends, so it never pulls you out of the flow (the same idea as the quiet timer). The satellites wait for you: the window shows "3 satellites came back" above the profiles, and the menu bar has a quiet "3 satellites came back…" line. Review them as a checklist:
- **Done:** ticked off.
- **Snooze:** back into orbit; it comes back when the next session ends.
- **Task:** onto the task list.
- **Delete:** gone. Its text is erased; only the fact that one was parked is kept, for insights.

**Between sessions**, a launched thought shows on the dashboard as "in orbit" and comes back when the next session ends. During a session, the window only shows how many are in orbit, not what they say.

**The task list** is a checklist on the dashboard, kept in the app, as long as you like. Ticked-off tasks stay underneath for 24 hours ("Done · last 24 hours"), so one ticked by accident can be unticked; after that they drop off the list (they're still kept for insights). Later: export to Reminders, Todoist and the like.

**In the browser extension**, the popup (focused and ready to type into during a session) and every redirect page have the launch box. When the extension is linked to the app, each satellite is handed over and the app keeps it from then on, so there's one list to review, in the app. The extension holds on to a satellite until the app confirms it has it, so one launched as the link drops goes over next time. Without the app, the extension keeps them itself, with the same rules: they come back however the session ends, and the popup's start screen shows the same quiet "came back" checklist, what's in orbit, and the task list with its 24 hours of ticked-off tasks. If the extension links to the app later, everything it kept moves over.

**The look (with the UI redesign in Phase 5):** dreamy and slow. Tiny satellites drift around the UI in lazy orbits among faint, twinkling stars, e.g. around the launch box and the task list, and a launched thought visibly lifts off and joins them. It should feel calm, never busy: slow loops of tens of seconds, soft glows, nothing that flickers or pulls the eye during a session. It's drawn with CSS or a small canvas (no animation library) and stays still with reduced motion.

Satellites also count in insights, e.g. "You parked 12 thoughts this week instead of acting on them."

---

## 5. Rewards: the night sky

One big sky that keeps growing as you focus, a bit like Obsidian's graph view: you never start a new page, your constellations just build outward. Everything in it is earned by focusing, drawn by code and kept on your device.

### Stars
- **Every session adds a star, and every star twinkles.** Longer sessions make bigger, brighter stars, and overtime makes a star twinkle a little brighter still. That's the secret overtime bonus (§2), never announced.
- **Color comes from the profile.** Each profile has a star color, e.g. warm gold for Writing and blue-white for Deep Work, so the sky shows at a glance how you spend your time. The starter profiles (and profiles that already exist when the sky ships) get default colors from a calm palette. Creating a profile includes picking its star color, wherever profiles are created (the extension's settings today), and it can be changed later.
- **Short sessions:** a star's size and brightness follow its minutes, so a 5-minute session is a faint speck next to a 90-minute one. Stardust and the chance of rare events count focused *minutes*, not sessions, so splitting one session into many earns nothing extra.
- **Back-to-back sessions share a star.** A session under 30 minutes that starts within 10 minutes of the last one ending joins that star, which grows to match, as long as both are for the same profile (so a star keeps one color). Sessions of 30 minutes or more always get their own star.
- **The smallest star is 5 minutes.** A lone session shorter than that (often an accidental start) leaves no star, though its minutes still count toward stardust.
- **Missed days cost nothing.** The sky never loses anything, so there's no streak guilt.

### Constellations and the Milky Way
- **One constellation per week.** Each week's stars (weeks start on the computer's first day of the week, as in the weekly report) connect into that week's constellation. Each star sits in its day's slice of the week, left to right, at a height of its own, and the fewest, shortest lines join them, so each constellation's shape is unique to you. A week with gaps is still a constellation: missed days never break anything.
- **Naming:** every constellation starts with a made-up name like "The Quiet Heron" (never the same as another), and you can rename it from the weekly report, under the week's title. A blank name goes back to the made-up one. Only names are saved; the shapes are worked out from the session log.
- **Two layouts, with an animated move between them.** In the Sky view, constellations pack in close, slightly overlapping and zoomed in, so the sky reads as one starry collection: the newest in the middle and older ones spiralling out, fitted above the cards. In Explore they spread out into separate constellations that fill the sky (for performance, older ones will fold into the Milky Way's glow rather than all being drawn). In the weekly report they spread out and line up in week order, and the report shows that week's constellation softly behind its header and week title, like a hero image behind a page header.
- **Names on hover, in Explore.** The Sky page shows no names, so the sky stays a sky. In Explore, hovering a constellation makes it shine a little brighter and brings its name up beneath it.
- **The Milky Way** fills in slowly as your total focus hours grow. It's also the zoomed-out view: from far away, older constellations fold into its glow.

### Planets and moons
- **A planet for every month you focus at all.** It's generated from a seed (colors, bands, rings), so no two people's planets look alike. Its size grows with that month's focus time. Planets drift slowly across the sky.
- **Moons** are earned around that month's planet, from focus streaks and from rare events.

### Comets: resisting a distraction
- Leaving the intention gate for "Back to focus" instead of continuing can bring a comet.
- **Don't reward the trip, reward the turn-around.** Only the first resist per site per day counts, and the daily chance doesn't grow with more visits, so going to a site just to resist it earns nothing. Comets stay rare enough to be a nice surprise, not a target. (General reasoning, not research: worth revisiting if it seems to pull people toward the sites.)

### Rare events
- Each finished session rolls a very small chance of something special, rising with the time you've focused today: a shooting star, a meteor shower, an aurora, a supernova. Personal bests (longest session, a streak record) can trigger one for sure.
- The roll uses a random secret kept on the device, so events can't be predicted or replayed.
- Later, some events leave a collectable for the observing spot.

### Light pollution
- Outside a session, the sky is washed out by a faint glow and haze. When you lock in, the pollution fades away and the sky is crisp for the whole session, while your new star forms. This is the brand metaphor made playable.
- **Afterglow:** after a session ends, the sky stays clear for a while (about 20% of the session length) before the haze creeps back in.
- **The sky lives behind everything** in the desktop window, and the other pages' glass cards float over it, so you see the haze between sessions and the clear sky while you're locked in. The cards are slightly 3D: only their glass tilts under the pointer, with a sheen following it, so the text stays sharp.

### The Sky page (home)
The desktop window opens on the Sky. Its pages are **Sky · Profiles · Your week · Settings**, with a glowing pill that glides to the selected tab and pages that slide in from their tab's side.
- **Starting a session:** along the bottom of the sky is a row of buttons, one per profile, each with its star color and timer length. Tap one to lock in. This is the only place sessions start in the window (the menu bar still works).
- **During a session** the timer floats over the clear sky while your star forms, with End session below it. There's no separate session screen.
- **Satellites live here too:** the launch box, the card of satellites that came back after a session (passive, never a pop-up), and the task list behind a small "Tasks" button. Later the ones in orbit are drawn in this sky (Phase 4).
- **Telescope drift (in Explore):** while exploring, moving the pointer over the sky pans and zooms it gently toward the pointer, like nudging a telescope, with the nearer layers moving a little more for depth. Outside Explore the sky stays put, since moving it behind the buttons was too much. It's only the feeling of movement, not real navigation (pan and zoom come with performance at scale). It stays still under `prefers-reduced-motion`.
- **Explore:** an Explore button clears the haze, lets the sky drift with the pointer, and drifts the buttons and cards toward you as they fade, as if puffing out of existence, so the sky is on its own to admire and name constellations. They come back the same way. The pollution is mood, not a lock. Under `prefers-reduced-motion` it's a plain fade.
- **The stardust total** sits on the Sky page. Later it opens the observing spot's drawer for decorating and companions, so rewards don't need a page of their own.

### Profiles page
Only for setting up profiles: each one's timer, apps and star color, and a summary of its sites (set in the extension). Panels unfold rather than pop open. It doesn't start sessions, which keeps its purpose clear.

### Stardust
- Focus earns stardust: 1 per focused minute, with overtime minutes worth 1.5× (unannounced). The idle tail isn't counted (§2).
- It's shown as a running total from Phase 4 on. Nothing spends it yet; it's saved for the observing spot.
- Stardust, like everything in the sky, is worked out from the session log rather than stored on its own, so older sessions count too once it ships. Phase 2's session log must therefore keep everything rewards need: start, end, focused minutes, overtime, idle tail, profile, and gate outcomes.

### Later: the observing spot and companions
- **Your spot** is the foreground at the bottom of the sky: a campsite, rooftop, lighthouse or lake shore that you build up over time (tent → cabin → observatory) and decorate with things bought with stardust or found in rare events.
- **The town on the horizon** is where the light pollution comes from. When you lock in, its windows go dark one by one.
- **Companions:** small, cute characters who keep you company during sessions, e.g. watching through the telescope while you focus and dozing off when you go idle.
- This needs an art style and a set of assets, so it comes after the sky itself. Style still to decide. One option is dark silhouettes against the sky with small glowing details, which matches the icon and keeps each asset cheap to draw.

### What to protect
- **No paywall, ever.** Everything is earned by focusing.
- **Calm, not a slot machine.** Rare things should feel like discoveries.
- **Dreamy.** Motion is soft and floaty (drifting, fading, gentle glow), never snappy or flashy.
- **Drawn by code, not image packs.** It keeps the app small and gives every sky its own planets and shapes.
- **Local only.** Nothing leaves the device unless you share a constellation (below).

### Performance at scale
The sky has to stay smooth after years of use (aim for 20,000+ stars, roughly ten sessions a day for five years):
- One canvas. Static layers (older stars, the Milky Way) are drawn once into off-screen images and only redrawn when you pan or zoom.
- Only stars on screen twinkle, found with a spatial index. Zoomed out, detail folds into glow instead of drawing every star.
- Each constellation's position is worked out once, when it forms, and saved. There's no physics simulation running like Obsidian's graph.
- The sky only renders while its window is open and visible, and twinkling stops under `prefers-reduced-motion`.

### Architecture
- A reward engine turns the session log into plain events: minutes, overtime minutes, streak days, distractions resisted, satellites parked, rare events. Like the weekly report, the app's Rust core supplies the log and the engine itself is TypeScript in `packages/core`, unit-tested. The device's secret for rare events is generated once and kept in the app's database.
- Given the same log and the device's secret, it always produces the same sky, so the sky rebuilds after an import or a sync.
- The sky is one swappable renderer over those events, so the community can build other "worlds" later.

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

**In the desktop app:** "Your week" in the header, between sessions, opens the report for the week in local time, starting on the first day of the week set on the computer (read from macOS's Language & Region settings, or the language's default elsewhere), with arrows back to earlier weeks. Clicking the week's title opens a calendar to jump to any week, with a dot on each day that had a session. The app's Rust core only reads the log for a range of dates; the report itself is worked out in `packages/core/src/insights.ts`, which knows the local time zone and can be shared with the extension later. It shows focus by day and profile with the change on last week; trips to redirected sites by hour, site and "why", how often you went back to focus, and grouped intentions; what became of the satellites launched; and up to three suggestions, each only when there's enough data behind it (a reason a site keeps pulling you in, the time of day focus goes best, a timer that fits how long sessions really run). The extension on its own keeps only a week of gate visits and no session log, so it has no report yet.

## 7. Other features
- **Lock In observes; it doesn't interject.** It works quietly in the background and collects what happens, for the weekly report and the sky. It never prompts you to start a session or nudges you outside what you set up yourself. (Session suggestions from apps, e.g. "Obsidian opened — start *Writing*?", were considered and dropped for this reason.)
- **App rules**: close or hide desktop apps (Discord, Steam, Slack) during a session.
- **Session intention + reflection**: a one-line goal at the start, and "did you do it?" on the page that waits after the session ends (never a pop-up).
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
    recipes/        # Built-in site recipes (JSON). Preview mocks live in the extension for now
                    # (apps/extension/components/preview) and move here once the desktop app needs them.
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
- ✅ pnpm monorepo, AGPL-3.0 license, shared types in `packages/core`, unit tests, in-repo browser tests, CI on every push.
- ✅ Lint (ESLint with typescript-eslint and eslint-plugin-vue) and format (Prettier), checked in CI.
- JSON schemas for recipes and profiles (still to do; they matter once import/export lands).

**Phase 1: Extension MVP** *(replaces your manual SocialFocus toggling first)*
- ✅ Standalone: sessions run from the extension popup, with no desktop app needed (the app plugs in later via Native Messaging).
- ✅ Recipes for Reddit, YouTube, X, Instagram, TikTok, Facebook, LinkedIn and Pinterest: tame, grayscale, redirect. (Still to do: check each on the real site.)
- ✅ Page rules (§1), including redirecting Shorts and Reels players inside single-page apps.
- ✅ Profiles: CRUD + starter profiles, manual start/stop, four site levels including Restricted, settings page with a Manage mode for deleting several profiles at once.
- ✅ Redirect destinations: intention gate with countdown (fixed or escalating), quote card (with your own quotes), productive URL, stuck page. Passes, and what happens when they run out (nothing, pause or redirect).
- ✅ Attempt counter + why-tap.
- ✅ Recipe editor with animated preview mocks for all eight sites. (Editing a recipe's selectors, and live mode, come in Phase 5.)

**Phase 2: Desktop app (Tauri)** *(macOS and Linux; Windows support comes later: Native Messaging registry entries, idle time, and finding the browser behind a bridge)*
- ✅ Menu-bar app, session engine, quiet timer + idle detection.
- ✅ Strictness levels + emergency passes.
- ✅ Native Messaging link + extension heartbeat: if the extension goes quiet during a session, warn → close that browser → count the session as broken, depending on strictness. The app and extension each work alone, so it only watches sessions whose profile tames sites, and closing is opt-in in Settings.
- ✅ App rules, SQLite. The session log keeps everything the rewards will need later (§5), so stardust and the sky can be worked out from past sessions once they ship. (On macOS, app launches come from `NSWorkspace` notifications; Linux has no unprivileged equivalent, so it checks every 10 seconds during sessions, about 9 ms each.)

**Phase 3: Satellites & insights**
- ✅ Satellites (§4) in the desktop app: the Alt+P box, menu-bar capture, the post-session return, and the task list.
- ✅ Satellites in the extension: capture from the popup and redirect pages, sent to the app when linked and kept by the extension when it runs alone.
- ✅ Weekly report (§6) in the desktop app.

**Phase 4: The night sky**
Built in slices, one PR each:
1. ✅ **Reward engine + first sky:** stars from the session log (sizes, shared and skipped stars), the stardust total, profile star colors (defaults, plus a choice when creating a profile), and one canvas behind the window with twinkling stars, light pollution between sessions, a clear sky during them with an afterglow, glass cards that tilt under the pointer, sliding pages, and sample sessions for development builds.
2. ✅ **The Sky as home:** the Sky page with its profile buttons, the session over the sky, satellites and tasks, the telescope drift and Explore; the Profiles page for editing only; and animations for the weekly report's calendar (switching weeks and months, opening and closing it).
3. ✅ **Weekly constellations:** naming, names shown beneath them on hover in Explore, the close-together layout on the Sky page and the spread-out week-order layout in the weekly report, and the week's constellation behind the report's header and week title.
4. **Planets and moons**, seeded per month.
5. **Comets** for resisted distractions, **rare events**, streak stats, and **satellites in the sky** (the ones in orbit and on the task list drawn as small satellites circling).
6. **Performance at scale:** pan and zoom, the spatial index, cached static layers, and older constellations folding into the Milky Way.

**Phase 5: Polish & release**
- UI redesign, from the reference images in `apps/desktop/references` (some of it is already in: glass cards with thin light borders and a sheen, the glowing tab pill, the floating dock of profiles, and dot charts with a "Peak" pill in the weekly report):
  - **Dark glass with colored glow** (`glow-cool-and-background-with-glassy-ui-elements-nice`): color bleeding softly from behind a card, e.g. the running session glowing in its profile's star color; a small floating toolbar of icon buttons for Explore (zoom in and out, recenter, name a constellation), which fits with pan and zoom (Phase 4); tiny stats in a corner while exploring; small colored status dots.
  - **Charts** (`ui-charts-dots-chart-cool-other-charts-cool-too-i-like-ui`): a big number with a small "vs last week" beside it on every report card; hatched bars for comparisons (this week against last), with the one you're looking at solid and a pill showing the change; thin segmented bars for each profile's share of focus; a "compared to" week next to the week picker.
  - **Floating boxes** (`ui-floating-boxes`): on wider windows, a bento grid for the weekly report and Profiles, with cards of different sizes side by side and one accent card in a star color (e.g. the week's top suggestion); larger corner radii and soft, wide shadows; a date block ("Friday · Oct 30") style for headers. Tags on tasks only if the user sets them (§7: the app observes, it doesn't label things for you).
- The satellites' dreamy orbiting look, first-use tooltip and animation (§4). Along with it, clearer help text for app rules (what Close and Hide do, and that rules apply when a session starts and again whenever the app is opened during it).
- Richer report charts if the plain CSS dot charts stop being enough, e.g. focus across many weeks or a day-by-hour heatmap. A chart library such as [vue-data-ui](https://vue-data-ui.graphieros.com/docs) could do these; weigh its size against the performance budget (§8) first.
- A short tutorial for new users, in the app and the extension: a skippable walkthrough of starting a session, profiles and site levels, the redirect page, launching and reviewing satellites (Alt+P and the popup), and linking the app to the browser. It can be replayed from Settings.
- Recipe live mode + element picker.
- More built-in recipes as people ask for them (e.g. Twitch, Threads, Bluesky).
- Optional daily quote fetch.
- Export/import.
- Signed builds: macOS notarization requires a paid Apple account, while unsigned builds work with a Gatekeeper warning. Also publish to the Chrome Web Store and Firefox Add-ons.

**Phase 6: Website, community sky & sync**
- Marketing website (§10) + community-worlds gallery.
- Constellation sharing endpoint.
- Self-hostable sync server, then optionally the hosted tier.

**Later: the observing spot** (once the art style is chosen)
- Your spot, the town on the horizon, decorations and companions, bought with stardust or found in rare events (§5).

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
- **Extension, automated:** `pnpm test` (core logic) and `pnpm test:e2e` (the real extension in Chrome, against stand-in pages for each site) run in CI on every push. They cover sessions, popup toggles, every recipe, page rules (including single-page navigation), redirects and the gate, every destination, pass expiry, restricted sites, settings and the profile editor.
- **Extension, by hand:** run `wxt dev` for Chrome and Firefox. In a *Writing* session:
  - each recipe hides what it says on the **real** site (stand-in pages can't catch a site changing its HTML), while threads, search and messages still work
  - grayscale is applied
  - x.com goes to the intention gate, whose Continue button counts down and grants a 5-minute pass that later expires
  - clicking a Short from a YouTube video goes to the gate, and Back returns to the video
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
