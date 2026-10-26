<script lang="ts" setup>
import { parseHttpUrl, type SavedLink } from '@lock-in/core';
import { computed } from 'vue';

const props = defineProps<{ link: SavedLink }>();

// Links are checked when saved, but check again before using one as an href.
const url = computed(() => parseHttpUrl(props.link.url));
</script>

<template>
  <h1>Back to what matters</h1>
  <p class="lead">You saved this for moments like this one.</p>
  <a v-if="url" class="primary open" :href="url.href">
    <span class="title">{{ link.title || url.hostname }}</span>
    <span class="host">{{ url.hostname }}</span>
  </a>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
}

.lead {
  margin: 8px 0 24px;
  color: var(--dim);
}

.open {
  display: grid;
  gap: 2px;
  border-radius: 10px;
  padding: 14px 16px;
  text-decoration: none;
}

.title {
  font-size: 16px;
}

.host {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.75;
}
</style>
