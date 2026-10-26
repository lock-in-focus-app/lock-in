<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <nav class="nav">
    <span class="m-slot"><span class="m-logo" /></span>
    <span class="m-slot"><span class="m-icon" /></span>
    <MockRegion toggle="hideExplore">
      <span class="m-slot"><span class="m-icon accent" /></span>
    </MockRegion>
    <span class="m-slot"><span class="m-icon" /></span>
    <span class="m-slot"><span class="m-icon" /></span>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
}
</style>
