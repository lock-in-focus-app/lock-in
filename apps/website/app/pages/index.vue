<script setup lang="ts">
const description =
  'A free, open-source focus app. Block, tame or redirect distracting sites and apps, and watch your night sky fill with stars as you focus.';

usePageSeo({ title: 'Seiza · Tame distractions, watch your sky fill with stars', description });

// Tells search engines what Seiza is: the site's name, and the app, which is free.
useHead({
  script: [
    {
      type: 'application/ld+json',
      textContent: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Seiza', url: `${siteUrl}/` },
          {
            '@type': 'SoftwareApplication',
            name: 'Seiza',
            description,
            url: `${siteUrl}/`,
            image: `${siteUrl}/og.jpg`,
            applicationCategory: 'ProductivityApplication',
            operatingSystem: 'macOS, Linux',
            downloadUrl: 'https://github.com/seiza-app/seiza/releases/latest',
            license: 'https://www.gnu.org/licenses/agpl-3.0.html',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
        ],
      }),
    },
  ],
});
</script>

<template>
  <div class="site-page">
    <HomeHeroSection />
    <HomeTameSection />
    <HomePauseSection />
    <HomeSkySection />
    <HomeSatellitesSection />
    <HomePrivacySection />
    <HomeInstallSection />
  </div>
</template>
