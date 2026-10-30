<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="body">
    <nav class="nav">
      <span class="m-slot"><span class="m-logo" /></span>
      <span v-for="n in 5" :key="n" class="m-slot"><span class="m-icon" /></span>
    </nav>
    <main class="m-stack column">
      <MockRegion toggle="hideHomeFeed">
        <div class="m-card feed">
          <div v-for="w in ['85%', '70%', '90%']" :key="w" class="post">
            <span class="m-avatar" />
            <div>
              <span class="m-line" style="--w: 30%" />
              <span class="m-line strong" :style="{ '--w': w }" />
              <span class="m-line" style="--w: 50%" />
            </div>
          </div>
        </div>
      </MockRegion>
      <p class="m-calm">Posting, search and messages still work</p>
    </main>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  padding: 8px 10px;
}

.nav {
  display: flex;
  flex-direction: column;
}

.column {
  width: 100%;
  max-width: 260px;
  margin: 0 auto;
}

.post {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  padding: 5px 0;
  border-bottom: 1px solid var(--surface-2);
}

.post:last-child {
  border-bottom: none;
}
</style>
