import { recipes } from '@lock-in/recipes';
import { defineConfig } from 'wxt';

const recipeSites = recipes.flatMap((recipe) => recipe.matches);

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Lock In',
    description: 'Tame, block, or redirect distracting sites during focus sessions.',
    homepage_url: 'https://github.com/lock-in-focus-app/lock-in',
    // "WithHostAccess" limits redirects to the recipe sites below, so the browser doesn't
    // warn that Lock In can block content on every page.
    permissions: ['storage', 'activeTab', 'alarms', 'declarativeNetRequestWithHostAccess'],
    host_permissions: recipeSites,
    // Redirected visits land on the redirect page. Chrome only allows that if the page the
    // visit came *from* may load it, and a link to Reddit can be on any site, so every site
    // may. use_dynamic_url stops websites from loading it directly to detect Lock In.
    web_accessible_resources: [{ resources: ['redirect.html'], matches: ['<all_urls>'], use_dynamic_url: true }],
  },
});
