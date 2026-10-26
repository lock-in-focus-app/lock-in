<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <nav class="guide">
    <span class="item"><span class="icon" /></span>
    <MockRegion toggle="hideShorts">
      <span class="item"><span class="icon shorts" /></span>
    </MockRegion>
    <span class="item"><span class="icon" /></span>
    <span class="item"><span class="icon" /></span>
  </nav>
</template>

<style scoped>
.guide {
  display: flex;
  flex-direction: column;
  width: 18px;
}

.item {
  display: block;
  padding-bottom: 8px;
}

.icon {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: var(--ink);
}

.icon.shorts {
  background: var(--accent);
}
</style>
