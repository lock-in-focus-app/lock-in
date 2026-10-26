<script lang="ts" setup>
import MockRegion from '../MockRegion.vue';
</script>

<template>
  <div class="body">
    <nav class="nav">
      <span class="item"><span class="m-logo" /></span>
      <span class="item"><span class="m-icon" /></span>
      <span class="item"><span class="m-icon" /></span>
      <MockRegion toggle="hideExplore"
        ><span class="item"><span class="m-icon" /></span
      ></MockRegion>
      <MockRegion toggle="hideReels"
        ><span class="item"><span class="m-icon accent" /></span
      ></MockRegion>
      <span class="item"><span class="m-icon" /></span>
    </nav>

    <main class="m-stack feed">
      <MockRegion toggle="hideHomeFeed">
        <div class="stories">
          <span v-for="n in 6" :key="n" class="story" />
        </div>
        <div class="post">
          <div class="post-head">
            <span class="m-avatar" />
            <span class="m-line" style="--w: 30%" />
          </div>
          <div class="m-box photo" />
          <span class="m-line strong" style="--w: 70%" />
        </div>
      </MockRegion>
      <p class="m-calm">Messages and profiles still work</p>
    </main>

    <aside>
      <MockRegion toggle="hideHomeFeed">
        <span class="m-badge">Suggested for you</span>
        <div v-for="n in 3" :key="n" class="suggestion">
          <span class="m-avatar" />
          <span class="m-line" style="--w: 80%" />
        </div>
      </MockRegion>
    </aside>
  </div>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 18px 1fr 100px;
  gap: 14px;
  padding: 10px;
}

.nav {
  display: flex;
  flex-direction: column;
}

/* Spacing sits inside each item, so a hidden one leaves no gap. */
.item {
  display: block;
  padding-bottom: 9px;
}

.nav .m-logo {
  border-radius: 6px;
  background: linear-gradient(45deg, #f9a03f, var(--accent), #8a3ab9);
}

.feed {
  max-width: 220px;
  margin: 0 auto;
  width: 100%;
}

.stories {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.story {
  flex: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--accent);
  border-radius: 50%;
  background: var(--surface-2);
}

.post-head {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}

.photo {
  height: 92px;
  margin-bottom: 3px;
}

.suggestion {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px;
  align-items: center;
  margin-bottom: 5px;
}
</style>
