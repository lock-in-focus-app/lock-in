<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
import TwitchSideNav from './TwitchSideNav.vue';
</script>

<template>
  <div class="body">
    <TwitchSideNav />
    <main class="m-stack">
      <MockRegion toggle="hideFrontPage">
        <div class="carousel">
          <span class="m-box side" />
          <div class="m-box stream"><span class="m-badge accent">LIVE</span></div>
          <span class="m-box side" />
        </div>
        <span class="m-line strong" style="--w: 40%" />
        <div class="shelf">
          <span v-for="n in 4" :key="n" class="m-box thumb" />
        </div>
      </MockRegion>
      <p class="m-calm">Search and the channels you follow still work</p>
    </main>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  padding: 8px 10px;
}

.carousel {
  display: grid;
  grid-template-columns: 1fr 3fr 1fr;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}

.stream {
  height: 80px;
  padding: 4px;
  background: color-mix(in srgb, var(--accent) 40%, var(--surface-2));
}

.side {
  height: 56px;
}

.shelf {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-top: 4px;
}

.thumb {
  height: 34px;
}
</style>
