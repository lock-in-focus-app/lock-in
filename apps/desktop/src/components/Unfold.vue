<script setup lang="ts">
// Grows its content open from nothing and folds it away again, so a panel doesn't pop in and
// push everything below it at once. Under reduced motion it just appears.

const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const durationMs = 420;
const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function animate(element: Element, open: boolean, done: () => void) {
  const panel = element as HTMLElement;
  if (still.matches) return done();
  const height = `${panel.offsetHeight}px`;
  const shut = { height: '0px', opacity: 0, transform: 'translateY(-6px)', filter: 'blur(2px)' };
  const shown = { height, opacity: 1, transform: 'none', filter: 'blur(0)' };
  panel.style.overflow = 'hidden';
  const animation = panel.animate(open ? [shut, shown] : [shown, shut], { duration: durationMs, easing });
  animation.onfinish = () => {
    panel.style.overflow = '';
    done();
  };
}
</script>

<template>
  <Transition
    :css="false"
    @enter="(el, done) => animate(el, true, done)"
    @leave="(el, done) => animate(el, false, done)"
  >
    <slot />
  </Transition>
</template>
