<script lang="ts" setup>
import { ref } from 'vue';

const quoteList = useStorageItem(ownQuotes);
const quoteText = ref('');
const quoteAuthor = ref('');

async function addQuote() {
  await addOwnQuote(quoteText.value, quoteAuthor.value);
  quoteText.value = '';
  quoteAuthor.value = '';
}
</script>

<template>
  <h2>Your quotes</h2>
  <p class="help">
    Shown on the Quote page, mixed in with the built-in ones and picked more often. Every profile shares them. Pick
    lines that get you back to work, not just ones that sound nice.
  </p>
  <ul v-if="quoteList?.length" class="list items">
    <li v-for="quote in quoteList" :key="quote.id">
      <span>
        <span class="name">{{ quote.text }}</span>
        <span v-if="quote.author" class="detail">{{ quote.author }}</span>
      </span>
      <button type="button" class="text-button" aria-label="Remove quote" @click="removeOwnQuote(quote.id)">
        Remove
      </button>
    </li>
  </ul>
  <form class="add quotes" @submit.prevent="addQuote">
    <input
      v-model="quoteText"
      class="wide"
      aria-label="Quote"
      placeholder="A quote that gets you back to work"
      maxlength="280"
    />
    <input v-model="quoteAuthor" aria-label="Author" placeholder="Author (optional)" />
    <button type="submit" :disabled="!quoteText.trim()">Add quote</button>
  </form>
</template>
