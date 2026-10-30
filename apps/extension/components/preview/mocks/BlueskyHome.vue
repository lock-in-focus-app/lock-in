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
      <MockRegion toggle="hideHomeFeed">
        <div v-for="w in ['90%', '75%']" :key="w" class="post">
          <span class="m-avatar" />
          <div>
            <span class="m-line" style="--w: 35%" />
            <span class="m-line strong" :style="{ '--w': w }" />
            <div class="actions">
              <span class="m-icon small" />
              <MockRegion toggle="hideCounts" axis="x"><span class="count">12</span></MockRegion>
              <span class="m-icon small" />
              <MockRegion toggle="hideCounts" axis="x"><span class="count">48</span></MockRegion>
            </div>
          </div>
        </div>
      </MockRegion>
      <p class="m-calm">Your profile, search and messages still work</p>
    </main>

    <aside class="m-stack">
      <div class="m-search side-search" />
      <MockRegion toggle="hideTrending">
        <div class="m-card">
          <span class="m-badge">Trending</span>
          <span v-for="w in ['80%', '65%', '75%', '55%']" :key="w" class="m-line" :style="{ '--w': w }" />
        </div>
      </MockRegion>
    </aside>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 18px 1fr 110px;
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

.post {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid var(--surface-2);
}

.actions {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
}

.m-icon.small {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.count {
  display: block;
  padding-right: 8px;
  color: var(--dim);
  font-size: 8px;
}

.side-search {
  max-width: none;
  margin: 0 0 6px;
}
</style>
