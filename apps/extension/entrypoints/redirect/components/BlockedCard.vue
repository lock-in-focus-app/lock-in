<script lang="ts" setup>
defineProps<{ siteName: string; profileName: string }>();
const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <h1>{{ siteName }} is off for now</h1>
  <p class="body">It's restricted during {{ profileName }} and will be back when the session ends.</p>
  <button type="button" class="primary" @click="emit('back')">Back to focus</button>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
}

.body {
  margin: 8px 0 24px;
  color: var(--dim);
  font-size: 15px;
}
</style>
