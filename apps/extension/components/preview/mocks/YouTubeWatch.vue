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
        <div class="player">
          <MockRegion toggle="hideEndScreen" class="endscreen">
            <div class="tiles">
              <span v-for="n in 4" :key="n" class="m-box tile" />
            </div>
          </MockRegion>
        </div>
        <div class="details">
          <span class="m-line strong" style="--w: 75%" />
          <span class="m-line" style="--w: 40%" />
        </div>
        <MockRegion toggle="hideComments">
          <div class="comments">
            <div v-for="w in ['80%', '60%']" :key="w" class="comment">
              <span class="m-avatar" />
              <div>
                <span class="m-line" style="--w: 30%" />
                <span class="m-line" :style="{ '--w': w }" />
              </div>
            </div>
          </div>
        </MockRegion>
      </main>
      <aside class="m-stack side">
        <MockRegion toggle="hideRecommendations">
          <div v-for="n in 3" :key="n" class="rec">
            <span class="m-box rec-thumb" />
            <div>
              <span class="m-line strong" style="--w: 90%" />
              <span class="m-line" style="--w: 60%" />
            </div>
          </div>
        </MockRegion>
        <MockRegion toggle="hideShorts">
          <span class="m-badge accent">Shorts</span>
          <div class="shorts">
            <span v-for="n in 3" :key="n" class="m-box short" />
          </div>
        </MockRegion>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.play {
  border-radius: 5px;
}

.body {
  display: grid;
  grid-template-columns: auto 1fr 110px;
  gap: 10px;
  padding: 8px 10px;
}

.player {
  position: relative;
  height: 84px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: #05070d;
}

.endscreen {
  position: absolute;
  inset: 12% 14%;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}

.tile {
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
}

.details {
  margin-bottom: 6px;
}

.comment {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  margin-bottom: 4px;
}

.rec {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 5px;
  margin-bottom: 5px;
}

.rec-thumb {
  aspect-ratio: 16 / 9;
}

.shorts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.short {
  aspect-ratio: 9 / 14;
  background: color-mix(in srgb, var(--accent) 25%, var(--surface-2));
}
</style>
