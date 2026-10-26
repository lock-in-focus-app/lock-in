<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <nav class="nav">
    <span class="item"><span class="m-logo" /></span>
    <span class="item"><span class="m-icon" /></span>
    <MockRegion toggle="hideExplore">
      <span class="item"><span class="m-icon accent" /></span>
    </MockRegion>
    <span class="item"><span class="m-icon" /></span>
    <span class="item"><span class="m-icon" /></span>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
}

/* Spacing sits inside each item, so a hidden one leaves no gap. */
.item {
  display: block;
  padding-bottom: 10px;
}
</style>
