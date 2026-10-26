<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="page">
    <header class="m-header">
      <span class="m-logo" />
      <div class="m-search small" />
      <div class="icons">
        <span v-for="n in 5" :key="n" class="m-icon" />
      </div>
    </header>

    <div class="body">
      <aside class="m-card profile">
        <div class="m-box banner" />
        <span class="m-avatar" />
        <span class="m-line strong" style="--w: 70%" />
        <span class="m-line" style="--w: 90%" />
      </aside>

      <main class="m-stack">
        <div class="m-card composer">
          <span class="m-avatar" />
          <span class="m-box pill" />
        </div>
        <MockRegion toggle="hideFeed">
          <div v-for="n in 2" :key="n" class="m-card post">
            <div class="post-head">
              <span class="m-avatar" />
              <span class="m-line" style="--w: 50%" />
            </div>
            <span class="m-line strong" style="--w: 90%" />
          </div>
        </MockRegion>
        <p class="m-calm">Messaging, jobs and profiles still work</p>
      </main>

      <aside class="m-stack">
        <MockRegion toggle="hideNews">
          <div class="m-card">
            <span class="m-badge">LinkedIn News</span>
            <div v-for="w in ['85%', '70%', '90%', '60%']" :key="w" class="news">
              <span class="bullet" /><span class="m-line" :style="{ '--w': w }" />
            </div>
          </div>
        </MockRegion>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.m-logo {
  border-radius: 4px;
}

.small {
  flex: none;
  width: 90px;
  margin: 0;
}

.icons {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  gap: 12px;
}

.body {
  display: grid;
  grid-template-columns: 80px 1fr 100px;
  gap: 10px;
  padding: 8px 10px;
}

.profile {
  align-self: start;
  padding-top: 0;
  overflow: hidden;
  text-align: center;
}

.banner {
  height: 18px;
  margin: 0 -8px 4px;
  border-radius: 0;
  background: color-mix(in srgb, var(--accent) 35%, var(--surface-2));
}

.profile .m-avatar {
  display: block;
  margin: -12px 0 4px;
  border: 2px solid var(--surface);
}

.composer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.pill {
  flex: 1;
  height: 12px;
  border-radius: 999px;
}

.post {
  margin-bottom: 6px;
}

.post-head {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.news {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bullet {
  flex: none;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dim);
}
</style>
