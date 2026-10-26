<script lang="ts" setup>
// A grid of Pins in staggered columns. The heights repeat so the drawing never changes.
defineProps<{ count: number }>();
const heights = [44, 30, 56, 36, 48, 28, 40, 52, 34, 46];
</script>

<template>
  <div class="masonry">
    <span v-for="n in count" :key="n" class="m-box pin" :style="{ height: `${heights[(n - 1) % heights.length]}px` }" />
  </div>
</template>

<style scoped>
.masonry {
  columns: 5;
  column-gap: 5px;
}

.pin {
  display: block;
  margin-bottom: 5px;
  break-inside: avoid;
  border-radius: 6px;
}
</style>
