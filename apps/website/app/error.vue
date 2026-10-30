<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const missing = computed(() => props.error.statusCode === 404);

useSeoMeta({ title: () => (missing.value ? 'Not found · Lock In' : 'Something went wrong · Lock In') });
</script>

<template>
  <NuxtLayout>
    <div class="site-page reading">
      <section id="top" class="page-head" data-name="Lost">
        <p class="kicker mono reveal">
          <b>{{ error.statusCode }}</b> · {{ missing ? 'Not found' : 'Something went wrong' }}
        </p>
        <h1 class="reveal" style="--d: 80ms">{{ missing ? 'Nothing up here' : 'A cloud got in the way' }}</h1>
        <p class="lede reveal" style="--d: 160ms">
          {{
            missing
              ? "There's no page at this address. It may have moved, or the link has a typo."
              : "This page didn't load properly. Trying again usually helps."
          }}
        </p>
        <p class="reveal" style="--d: 240ms">
          <a class="textlink" href="/" @click.prevent="clearError({ redirect: '/' })">Back to Lock In ›</a>
        </p>
      </section>
    </div>
  </NuxtLayout>
</template>
