<template>
  <section id="install" data-name="Install">
    <p class="kicker mono reveal"><b>06</b> · Install</p>
    <h2 class="reveal" style="--d: 80ms">Free, and yours to keep.</h2>
    <div class="install">
      <div class="hud glass reveal" style="--d: 220ms">
        <span class="mono">macOS · Linux</span>
        <h3>The desktop app</h3>
        <p>
          A .dmg for macOS, or a .deb or .AppImage for Linux. It isn't signed with a paid Apple Developer account, so
          macOS asks you to allow it once: open it, click Done, then System Settings › Privacy &amp; Security › Open
          Anyway.
        </p>
        <a class="btn primary" href="https://github.com/seiza-app/seiza/releases/latest">Download from GitHub</a>
      </div>
      <div class="hud glass reveal" style="--d: 300ms">
        <span class="mono status">In review</span>
        <h3>The browser extension</h3>
        <p>
          For Chrome, Brave, Edge, Arc, Firefox and Zen. It's in review at the Chrome Web Store and Firefox Add-ons.
          Until it's listed, you can build it from source.
        </p>
        <a class="btn ghost" href="https://github.com/seiza-app/seiza#getting-started">Build it from source</a>
      </div>
    </div>
    <p class="both reveal" style="--d: 380ms">
      The app and the extension each work on their own. Install both and they link up by themselves.
    </p>
    <SiteFooter class="reveal" style="--d: 440ms" />
  </section>
</template>
