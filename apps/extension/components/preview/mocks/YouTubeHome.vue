<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
import YouTubeGuide from './YouTubeGuide.vue';
</script>

<template>
  <div class="page">
    <header class="m-header">
      <span class="m-logo play" />
      <div class="m-search" />
      <span class="m-avatar" />
    </header>

    <div class="body">
      <YouTubeGuide />
      <main class="m-stack">
        <MockRegion toggle="hideHomeFeed">
          <div class="chips">
            <span v-for="n in 5" :key="n" class="m-box chip" />
          </div>
          <div class="grid">
            <div v-for="n in 3" :key="n">
              <div class="m-box thumb" />
              <span class="m-line strong" style="--w: 90%" />
              <span class="m-line" style="--w: 55%" />
            </div>
          </div>
          <MockRegion toggle="hideShorts">
            <span class="m-badge accent">Shorts</span>
            <div class="shorts">
              <div v-for="n in 5" :key="n" class="m-box short" />
            </div>
          </MockRegion>
        </MockRegion>
        <p class="m-calm">Search and subscriptions still work</p>
      </main>
    </div>
  </div>
</template>

<style scoped>
.play {
  border-radius: 5px;
}

.body {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  padding: 8px 10px;
}

.chips {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.chip {
  width: 28px;
  height: 10px;
  border-radius: 999px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}

.thumb {
  aspect-ratio: 16 / 9;
  margin-bottom: 3px;
}

.shorts {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}

.short {
  aspect-ratio: 9 / 14;
  background: color-mix(in srgb, var(--accent) 25%, var(--surface-2));
}
</style>
