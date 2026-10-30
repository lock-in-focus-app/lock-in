// https://nuxt.com/docs/api/configuration/nuxt-config
// A static site: `nuxt generate` prerenders every page into .output/public, which a Cloudflare
// Worker serves as static assets (wrangler.jsonc).
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Set explicitly: in Cloudflare's builds Nitro would pick its Worker preset, which points Wrangler
  // at a server entry this static site doesn't have.
  nitro: { preset: 'static' },
  // In cascade order: the apps' look, then the frame round the window, then each section.
  css: [
    '~/assets/css/theme.css',
    '~/assets/css/base.css',
    '~/assets/css/backdrop.css',
    '~/assets/css/frame.css',
    '~/assets/css/sections.css',
    '~/assets/css/hero.css',
    '~/assets/css/tame.css',
    '~/assets/css/pause.css',
    '~/assets/css/sky-section.css',
    '~/assets/css/satellites.css',
    '~/assets/css/privacy-install.css',
    '~/assets/css/reading.css',
    '~/assets/css/phones.css',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'theme-color', content: '#0b1020' },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      // Without JavaScript, the sections show at once instead of waiting to rise in.
      noscript: [
        { innerHTML: '<style>.reveal{opacity:1!important;transform:none!important;filter:none!important}</style>' },
      ],
    },
  },
});
