<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <nav class="guide">
    <span class="m-slot"><span class="m-icon" /></span>
    <MockRegion toggle="hideShorts">
      <span class="m-slot"><span class="m-icon accent" /></span>
    </MockRegion>
    <span class="m-slot"><span class="m-icon" /></span>
    <span class="m-slot"><span class="m-icon" /></span>
  </nav>
</template>

<style scoped>
.guide {
  display: flex;
  flex-direction: column;
  width: 18px;
}
</style>
