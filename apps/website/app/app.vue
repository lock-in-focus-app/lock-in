<script setup lang="ts">
// What every page shares in its head: the canonical address, without a trailing slash as the
// Worker serves it (html_handling in wrangler.jsonc), and the link preview. The 404 page renders
// error.vue instead, so it gets none of this.
const route = useRoute();
const url = computed(() => siteUrl + route.path);

useHead({ link: [{ rel: 'canonical', href: url }] });
useSeoMeta({
  ogUrl: url,
  ogType: 'website',
  ogSiteName: 'Seiza',
  ogLocale: 'en_US',
  ogImage: `${siteUrl}/og.jpg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'The Seiza wordmark over a starry night sky, with the headline "Social media is light pollution."',
  twitterCard: 'summary_large_image',
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
