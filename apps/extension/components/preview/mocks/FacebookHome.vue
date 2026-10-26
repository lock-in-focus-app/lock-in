<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="page">
    <header class="m-header">
      <span class="m-logo" />
      <div class="m-search small" />
      <div class="tabs">
        <span class="tab"><span class="m-icon accent" /></span>
        <MockRegion toggle="hideReels" axis="x" class="tab-region">
          <span class="tab"><span class="m-icon" /></span>
        </MockRegion>
        <span class="tab"><span class="m-icon" /></span>
        <span class="tab"><span class="m-icon" /></span>
      </div>
      <span class="m-avatar" />
    </header>

    <div class="body">
      <nav>
        <div class="m-row"><span class="m-avatar" /><span class="m-line" style="--w: 70%" /></div>
        <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 55%" /></div>
        <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 65%" /></div>
        <MockRegion toggle="hideReels">
          <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 45%" /></div>
        </MockRegion>
        <div class="m-row"><span class="m-icon" /><span class="m-line" style="--w: 60%" /></div>
      </nav>

      <main class="m-stack">
        <MockRegion toggle="hideNewsFeed">
          <div class="stories">
            <span v-for="n in 4" :key="n" class="m-box story" />
          </div>
          <div class="m-card composer">
            <span class="m-avatar" />
            <span class="m-box pill" />
          </div>
          <div class="m-card">
            <div class="post-head">
              <span class="m-avatar" />
              <span class="m-line" style="--w: 35%" />
            </div>
            <span class="m-line strong" style="--w: 80%" />
            <div class="m-box photo" />
          </div>
        </MockRegion>
        <p class="m-calm">Groups, Marketplace and Messenger still work</p>
      </main>

      <aside>
        <span class="m-line" style="--w: 50%" />
        <div v-for="n in 4" :key="n" class="m-row contact">
          <span class="m-avatar" /><span class="m-line" style="--w: 70%" />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.small {
  flex: none;
  width: 60px;
  margin: 0;
}

.tabs {
  display: flex;
  flex: 1;
  justify-content: center;
}

/* Spacing sits inside each tab, so a hidden one leaves no gap. */
.tab {
  display: block;
  padding: 0 9px;
}

.tab-region {
  --region-outline: -3px 6px -3px 6px;
}

.body {
  display: grid;
  grid-template-columns: 80px 1fr 80px;
  gap: 10px;
  padding: 8px 10px;
}

.contact {
  margin-top: 4px;
}

.stories {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-bottom: 6px;
}

.story {
  height: 46px;
  background: linear-gradient(180deg, var(--surface-2), color-mix(in srgb, var(--accent) 30%, var(--surface-2)));
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

.post-head {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.photo {
  height: 40px;
  margin-top: 4px;
}
</style>
