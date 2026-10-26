<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
import PinterestMasonry from './PinterestMasonry.vue';
import PinterestNav from './PinterestNav.vue';
</script>

<template>
  <div class="body">
    <PinterestNav />
    <main class="m-stack">
      <div class="m-search wide">
        <MockRegion toggle="hideSearchSuggestions" class="suggestions">
          <div class="m-card">
            <span class="m-badge">Popular on Pinterest</span>
            <div class="chips">
              <span v-for="n in 4" :key="n" class="m-box chip" />
            </div>
          </div>
        </MockRegion>
      </div>
      <MockRegion toggle="hideHomeFeed">
        <PinterestMasonry :count="15" />
      </MockRegion>
      <p class="m-calm">Search and your boards still work</p>
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

.wide {
  max-width: none;
  margin: 0 0 8px;
}

.suggestions {
  position: absolute;
  top: 20px;
  right: 30%;
  left: 0;
  z-index: 1;
}

.chips {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.chip {
  height: 22px;
  background: color-mix(in srgb, var(--accent) 20%, var(--surface-2));
}
</style>
