<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
import PinterestMasonry from './PinterestMasonry.vue';
import PinterestNav from './PinterestNav.vue';
</script>

<template>
  <div class="body">
    <PinterestNav />
    <main class="m-stack">
      <div class="m-card closeup">
        <div class="m-box photo" />
        <div>
          <span class="m-box save" />
          <span class="m-line strong" style="--w: 80%" />
          <span class="m-line" style="--w: 90%" />
          <span class="m-line" style="--w: 60%" />
        </div>
      </div>
      <MockRegion toggle="hideMoreLikeThis">
        <span class="m-badge">More to explore</span>
        <PinterestMasonry :count="10" />
      </MockRegion>
      <p class="m-calm">The Pin you opened, and saving it, still work</p>
    </main>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  padding: 8px 10px;
}

.closeup {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px;
  max-width: 240px;
  margin: 0 auto 8px;
}

.photo {
  height: 80px;
}

.save {
  display: block;
  width: 26px;
  height: 11px;
  margin: 0 0 6px auto;
  border-radius: 999px;
  background: var(--accent);
}
</style>
