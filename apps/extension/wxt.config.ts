import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Lock In',
    description: 'Tame, block, or redirect distracting sites during focus sessions.',
    permissions: ['storage', 'activeTab'],
  },
});
