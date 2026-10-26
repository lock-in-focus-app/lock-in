<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="page">
    <header class="m-header">
      <span class="m-logo" />
      <div class="m-search" />
      <span class="m-avatar" />
    </header>

    <div class="body">
      <nav class="nav">
        <div class="m-row"><span class="m-icon accent" /><span class="m-line strong" style="--w: 70%" /></div>
        <MockRegion toggle="hideExplore">
          <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 60%" /></div>
        </MockRegion>
        <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 75%" /></div>
        <MockRegion toggle="hideLive">
          <div class="m-row"><span class="m-icon live" /><span class="m-line" style="--w: 40%" /></div>
        </MockRegion>
        <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 65%" /></div>
      </nav>

      <main class="m-stack">
        <MockRegion toggle="hideForYou">
          <div class="video-row">
            <div class="video">
              <span class="m-line strong caption" style="--w: 60%" />
            </div>
            <div class="actions">
              <span v-for="n in 4" :key="n" class="action" />
            </div>
          </div>
        </MockRegion>
        <p class="m-calm">Search, messages and profiles still work</p>
      </main>
    </div>
  </div>
</template>

<style scoped>
.m-logo {
  border-radius: 5px;
  box-shadow: -2px -1px 0 #25f4ee;
}

.body {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 10px;
  padding: 8px 10px;
}

.live {
  background: color-mix(in srgb, var(--accent) 50%, var(--ink));
}

.video-row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 6px;
}

.video {
  position: relative;
  width: 88px;
  height: 134px;
  border-radius: 8px;
  background: linear-gradient(160deg, var(--surface-2), #05070d);
}

.caption {
  position: absolute;
  bottom: 8px;
  left: 8px;
}

.actions {
  display: grid;
  gap: 6px;
}

.action {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface-2);
}
</style>
