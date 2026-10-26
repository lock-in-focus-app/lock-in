<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="page">
    <header class="m-header">
      <span class="m-logo" />
      <div class="m-search">
        <MockRegion toggle="hideTrending" class="trending">
          <div class="m-card">
            <span class="m-badge">Trending today</span>
            <div v-for="w in ['80%', '65%', '72%']" :key="w" class="trend">
              <span class="arrow">↗</span><span class="m-line" :style="{ '--w': w }" />
            </div>
          </div>
        </MockRegion>
      </div>
      <span class="m-avatar" />
    </header>

    <div class="body">
      <nav class="nav">
        <span v-for="w in ['70%', '60%', '75%', '50%']" :key="w" class="m-line" :style="{ '--w': w }" />
      </nav>
      <main class="m-stack feed">
        <MockRegion toggle="hideFeeds">
          <div class="posts">
            <div v-for="n in 2" :key="n" class="m-card post">
              <span class="m-line" style="--w: 30%" />
              <span class="m-line strong" style="--w: 85%" />
              <div class="m-box image" />
            </div>
          </div>
        </MockRegion>
        <MockRegion toggle="hideSuggested">
          <div class="m-card">
            <span class="m-badge">Suggested for you</span>
            <span class="m-line strong" style="--w: 70%" />
            <span class="m-line" style="--w: 90%" />
          </div>
        </MockRegion>
        <MockRegion toggle="hidePromoted">
          <div class="m-card">
            <span class="m-badge accent">Promoted</span>
            <span class="m-line strong" style="--w: 60%" />
            <div class="m-box banner" />
          </div>
        </MockRegion>
        <p class="m-calm">Search, communities and threads still work</p>
      </main>
    </div>
  </div>
</template>

<style scoped>
.trending {
  position: absolute;
  top: 20px;
  right: 0;
  left: 0;
  z-index: 1;
}

.trend {
  display: flex;
  align-items: center;
  gap: 4px;
}

.arrow {
  color: var(--accent);
  font-size: 8px;
}

.body {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 10px;
  padding: 8px 10px;
}

.nav {
  padding-top: 4px;
}

.posts {
  display: grid;
  gap: 6px;
}

.image {
  height: 34px;
  margin-top: 4px;
}

.banner {
  height: 20px;
  margin-top: 4px;
  background: color-mix(in srgb, var(--accent) 35%, var(--surface-2));
}
</style>
