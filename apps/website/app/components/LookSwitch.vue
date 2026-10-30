<script setup lang="ts">
const { look, setLook } = useLook();
</script>

<template>
  <div class="look" role="group" aria-label="How light pollution looks">
    <span class="look-label">Haze:</span>
    <button type="button" :aria-pressed="look === 'city'" @click="setLook('city')">City lights</button>
    <button type="button" :aria-pressed="look === 'sunset'" @click="setLook('sunset')">Sunset</button>
  </div>
</template>
