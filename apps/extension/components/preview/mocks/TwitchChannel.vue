<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
import TwitchSideNav from './TwitchSideNav.vue';
</script>

<template>
  <div class="body">
    <TwitchSideNav />
    <main>
      <div class="m-box player" />
      <div class="info">
        <span class="m-avatar" />
        <div>
          <span class="m-line strong" style="--w: 60%" />
          <span class="m-line" style="--w: 40%" />
        </div>
      </div>
      <p class="m-calm">The stream you came for still plays</p>
    </main>
    <MockRegion toggle="hideChat" axis="x">
      <aside class="chat">
        <span class="m-badge">Stream chat</span>
        <span v-for="w in ['80%', '60%', '90%', '50%', '70%']" :key="w" class="m-line" :style="{ '--w': w }" />
        <span class="m-box input" />
      </aside>
    </MockRegion>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 10px;
  padding: 8px 10px;
}

.player {
  height: 110px;
  background: color-mix(in srgb, var(--accent) 40%, var(--surface-2));
}

.info {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  margin-top: 8px;
}

.chat {
  display: flex;
  flex-direction: column;
  width: 90px;
  height: 180px;
  padding: 6px;
  border-radius: 7px;
  background: var(--surface);
}

.input {
  height: 12px;
  margin-top: auto;
}
</style>
