import { recipes } from '@lock-in/recipes';
import { defineConfig } from 'wxt';

const recipeSites = recipes.flatMap((recipe) => recipe.matches);

const chromeKey =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAydKVix/EgyWAVc8qyi7dOkxVHpDYSl71NX619hw7CmRbRiXMBUDTq2Q/8ugOXqsIXTjTU0AjJH2bOxndoIj8Bh/DcCn4b967hsooiSwibTrAUKpad3ql/QZiZmR/Dzn4VVkNKhQaNTVrDJdlX5kdiJnE2y9FrTRDsYM0se/Xpy97YjagJClVVJzUfFJKTBI5SIuu9bBf3wm/23Zul6vpq0GIV2tAUZX09h5Vts3Gjtx6TjhpAUNQwcGkzGyjJ0UXfG8gXuTB2DcVjNHgd9OZXi4yf9PzZcp2b/pKueth59l6+Iv0KR6Rb8YUkcep4NleSaKv6TD+EtdLZlfV3eJ9qwIDAQAB';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: ({ browser }) => ({
    name: 'Lock In',
    description: 'Tame, block, or redirect distracting sites during focus sessions.',
    homepage_url: 'https://github.com/lock-in-focus-app/lock-in',
    // "WithHostAccess" limits redirects to the recipe sites below, so the browser doesn't
    // warn that Lock In can block content on every page.
    // nativeMessaging links the extension to the desktop app, when it's installed.
    permissions: ['storage', 'activeTab', 'alarms', 'declarativeNetRequestWithHostAccess', 'nativeMessaging'],
    host_permissions: recipeSites,
    // Redirected visits land on the redirect page. Chrome only allows that if the page the
    // visit came *from* may load it, and a link to Reddit can be on any site, so every site
    // may. use_dynamic_url stops websites from loading it directly to detect Lock In.
    web_accessible_resources: [{ resources: ['redirect.html'], matches: ['<all_urls>'], use_dynamic_url: true }],
    // Fixed ids, so the desktop app knows which extension may connect to it. In Chrome the id
    // comes from this public key (nfaamgjiehkppopelaampopbofjoepca); the app lists it in
    // apps/desktop/src-tauri/src/hosts.rs. Store builds get their own id once published.
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'lock-in@lock-in-focus-app.github.io' } } }
      : { key: chromeKey }),
  }),
});
