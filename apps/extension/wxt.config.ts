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
    // Redirected sites are sent to the intention gate, so they need to be able to load it.
    web_accessible_resources: [{ resources: ['gate.html'], matches: recipeSites }],
  },
});
