<script lang="ts" setup>
import { pickQuote, type Quote } from '@lock-in/core';
import { quotes } from '@lock-in/quotes';
import { ref } from 'vue';

const emit = defineEmits<{ back: [] }>();

const quote = ref<Quote>();
void ownQuotes.getValue().then((own) => (quote.value = pickQuote(quotes, own)));
</script>

<template>
  <figure v-if="quote">
    <blockquote>{{ quote.text }}</blockquote>
    <figcaption v-if="quote.author">{{ quote.author }}</figcaption>
  </figure>
  <button type="button" class="primary" @click="emit('back')">Back to focus</button>
</template>

<style scoped>
figure {
  margin: 0 0 32px;
}

blockquote {
  margin: 0;
  font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  font-size: 30px;
  line-height: 1.3;
  text-wrap: balance;
}

blockquote::before {
  content: '“';
  color: var(--glow);
}

blockquote::after {
  content: '”';
  color: var(--glow);
}

figcaption {
  margin-top: 12px;
  color: var(--dim);
}

figcaption::before {
  content: '— ';
}
</style>
