<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <nav class="m-stack">
    <span class="m-badge">Followed</span>
    <div v-for="n in 2" :key="n" class="m-row">
      <span class="m-avatar" />
      <span class="m-line" style="--w: 70%" />
    </div>
    <MockRegion toggle="hideRecommended">
      <span class="m-badge">Recommended</span>
      <div v-for="w in ['80%', '60%', '70%']" :key="w" class="m-row">
        <span class="m-avatar" />
        <span class="m-line" :style="{ '--w': w }" />
        <span class="live" />
      </div>
    </MockRegion>
  </nav>
</template>

<style scoped>
.live {
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #eb0400;
}
</style>
