<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="body">
    <nav class="nav">
      <span class="m-logo" />
      <span v-for="n in 5" :key="n" class="m-icon" />
    </nav>

    <main class="m-stack">
      <div class="tabs">
        <span class="m-line strong" style="--w: 30%" />
        <span class="m-line" style="--w: 30%" />
      </div>
      <div class="m-card composer">
        <span class="m-avatar" />
        <span class="m-line" style="--w: 60%" />
      </div>
      <MockRegion toggle="hideHomeTimeline">
        <div class="post">
          <span class="m-avatar" />
          <div>
            <span class="m-line" style="--w: 35%" />
            <span class="m-line strong" style="--w: 90%" />
            <span class="m-line" style="--w: 70%" />
          </div>
        </div>
        <MockRegion toggle="hidePromoted">
          <div class="post">
            <span class="m-avatar" />
            <div>
              <span class="m-badge accent">Ad</span>
              <span class="m-line strong" style="--w: 80%" />
              <div class="m-box ad" />
            </div>
          </div>
        </MockRegion>
        <div class="post">
          <span class="m-avatar" />
          <div>
            <span class="m-line" style="--w: 30%" />
            <span class="m-line strong" style="--w: 85%" />
          </div>
        </div>
      </MockRegion>
      <p class="m-calm">Search, messages and profiles still work</p>
    </main>

    <aside class="m-stack">
      <div class="m-search side-search" />
      <MockRegion toggle="hideTrending">
        <div class="m-card">
          <span class="m-badge">What's happening</span>
          <div v-for="w in ['70%', '85%', '60%']" :key="w" class="trend">
            <span class="m-line" style="--w: 40%" />
            <span class="m-line strong" :style="{ '--w': w }" />
          </div>
        </div>
      </MockRegion>
      <MockRegion toggle="hideWhoToFollow">
        <div class="m-card">
          <span class="m-badge">Who to follow</span>
          <div v-for="n in 2" :key="n" class="follow">
            <span class="m-avatar" />
            <span class="m-line" style="--w: 90%" />
            <span class="m-box pill" />
          </div>
        </div>
      </MockRegion>
    </aside>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 18px 1fr 120px;
  gap: 10px;
  padding: 8px 10px;
}

.nav {
  display: grid;
  align-content: start;
  gap: 9px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--surface-2);
  margin-bottom: 6px;
}

.composer,
.post,
.follow {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: start;
}

.composer {
  align-items: center;
  margin-bottom: 6px;
}

.post {
  padding: 6px 0;
  border-bottom: 1px solid var(--surface-2);
}

.ad {
  height: 26px;
  margin-top: 4px;
}

.side-search {
  max-width: none;
  margin: 0 0 6px;
}

.trend {
  margin-bottom: 4px;
}

.follow {
  grid-template-columns: auto 1fr auto;
  align-items: center;
  margin-bottom: 4px;
}

.pill {
  width: 22px;
  height: 9px;
  border-radius: 999px;
  background: var(--accent);
}
</style>
