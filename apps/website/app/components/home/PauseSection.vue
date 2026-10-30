<script setup lang="ts">
// The redirect page's five minutes, counting down from the first time you reach this section.
const WAIT = 300;
const section = ref<HTMLElement>();
const left = ref(WAIT);
const notNow = ref(false);
const clock = computed(() => `${Math.floor(left.value / 60)}:${String(left.value % 60).padStart(2, '0')}`);

let timer: ReturnType<typeof setTimeout> | undefined;
let watcher: IntersectionObserver | undefined;

function start() {
  const started = Date.now();
  const step = () => {
    left.value = Math.max(0, WAIT - Math.floor((Date.now() - started) / 1000));
    if (left.value) timer = setTimeout(step, 1000);
  };
  step();
}

onMounted(() => {
  watcher = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      watcher?.disconnect();
      start();
    },
    { root: document.getElementById('scroller'), threshold: 0.25 },
  );
  watcher.observe(section.value!);
});

onBeforeUnmount(() => {
  watcher?.disconnect();
  clearTimeout(timer);
});
</script>

<template>
  <section id="pause" ref="section" data-name="Pause">
    <div class="two">
      <div>
        <p class="kicker mono reveal"><b>02</b> · The redirect page</p>
        <h2 class="reveal" style="--d: 80ms">A pause before the scroll</h2>
        <p class="lede reveal" style="--d: 160ms">
          Visits to a redirected site go to a calm Lock In page first. Focus for five minutes, read your own if-then
          plan, or open one of your links. If you still need the site once the wait is up, take a few minutes on it. Or
          don't: <em>Not now</em> is always right there.
        </p>
        <p class="source reveal" style="--d: 240ms">
          <b>Why a pause works.</b> In a six-week field study of a pause-before-opening app, people opened the apps they
          chose 57% less. The easy way out mattered most; the wait helped too. (Grüning et al., 2023. One study, so a
          modest finding.)
        </p>
      </div>

      <div class="pause-card hud glass reveal" style="--d: 200ms">
        <div class="top">
          <span class="brand"><span>✦</span> Lock In</span>
          <span class="dest mono">x.com/home</span>
        </div>
        <h3>Focus for five minutes first</h3>
        <p class="sub">The countdown keeps going if you switch tabs.</p>
        <div class="clock">
          <span class="time">{{ clock }}</span>
          <span class="mono">Writing · session</span>
        </div>
        <div class="progress"><b :style="{ transform: `scaleX(${left / WAIT})` }"></b></div>
        <p class="plan">
          <span class="mono">Your if-then plan</span>
          When I want to scroll, I'll write one paragraph first.
        </p>
        <ul class="links">
          <li>My draft <span class="mono">docs.example.com</span></li>
          <li>Reading list <span class="mono">example.com</span></li>
        </ul>
        <div class="actions">
          <button class="btn ghost" type="button" @click="notNow = true">Not now</button>
          <button class="btn ghost" type="button" :disabled="left > 0">
            {{ left ? `Open x.com in ${clock}` : 'Take a few minutes on x.com' }}
          </button>
        </div>
        <p class="pause-note" aria-live="polite">
          {{ notNow ? 'Back to what you were doing. On the real page, this closes the tab.' : '' }}
        </p>
      </div>
    </div>
  </section>
</template>
