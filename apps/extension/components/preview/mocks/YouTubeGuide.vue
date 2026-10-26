<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <nav class="guide">
    <span class="item"><span class="m-icon" /></span>
    <MockRegion toggle="hideShorts">
      <span class="item"><span class="m-icon accent" /></span>
    </MockRegion>
    <span class="item"><span class="m-icon" /></span>
    <span class="item"><span class="m-icon" /></span>
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
</style>
