<script setup lang="ts">
// The frame round the window: two hairlines that crossfade as you lock in, bright corner ticks,
// readouts in the corners (local time, how clear the sky is, and the session), the top nav with
// the mark, and the constellation navigator along the bottom (the slot).
const { locked, lockedAt, toggle } = useLock();

// Filled in once the page is in the browser, so the prerendered page doesn't show a stale time.
const now = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  now.value = Date.now();
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(timer));

const pad = (n: number) => String(n).padStart(2, '0');
const clock = computed(() => {
  if (!now.value) return '--:--';
  const d = new Date(now.value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
});
const session = computed(() => {
  if (!locked.value || !lockedAt.value) return 'No session';
  const s = Math.max(0, Math.floor((now.value - lockedAt.value) / 1000));
  return `Locked in · ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
});
</script>

<template>
  <div class="frame">
    <div class="line hazy"></div>
    <div class="line clear"></div>
    <div class="ticks"></div>

    <p class="readout mono tl">
      Local <b>{{ clock }}</b>
    </p>
    <p class="readout mono tr">
      Seeing · <b class="warn state">{{ locked ? 'Clear' : 'Hazy' }}</b>
    </p>
    <p class="readout mono bl">
      Sky · <b class="warn state">{{ locked ? 'Dark' : 'Light-polluted' }}</b>
    </p>
    <p class="readout mono br">
      <button class="session" type="button" @click="toggle">
        <span class="dot" aria-hidden="true"></span>
        <span>{{ session }}</span>
        <span class="act">{{ locked ? 'End ›' : 'Lock in ›' }}</span>
      </button>
    </p>

    <!-- Links to a section of the home page aren't marked as the current page, so they're custom. -->
    <nav class="topnav" aria-label="Pages">
      <ul>
        <li>
          <NuxtLink v-slot="{ href, navigate }" to="/#tame" custom>
            <a :href="href ?? undefined" @click="navigate">How it works</a>
          </NuxtLink>
        </li>
        <li><NuxtLink to="/why-it-works">Why it works</NuxtLink></li>
      </ul>
      <NuxtLink v-slot="{ href, navigate }" to="/#top" custom>
        <a class="mark" :href="href ?? undefined" aria-label="Seiza, home" @click="navigate">
          <svg viewBox="28 28 72 72" aria-hidden="true">
            <path d="M64 30 Q67.5 60.5 98 64 Q67.5 67.5 64 98 Q60.5 67.5 30 64 Q60.5 60.5 64 30 Z" fill="#f5c86b" />
          </svg>
          <span class="brand">Seiza</span>
        </a>
      </NuxtLink>
      <ul>
        <li><NuxtLink to="/privacy">Privacy</NuxtLink></li>
        <li>
          <NuxtLink v-slot="{ href, navigate }" to="/#install" custom>
            <a :href="href ?? undefined" @click="navigate">Install</a>
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <slot />
  </div>
</template>
