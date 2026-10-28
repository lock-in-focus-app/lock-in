<script setup lang="ts">
// A list whose items drift in and out instead of snapping: one that arrives opens up and comes
// into focus, and one that leaves fades and blurs on its way, as its `data-leave` says (see
// `away`), before its gap closes, so the items below glide up. Under reduced motion they just
// come and go.

defineProps<{ tag?: string }>();

const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// Which way an item goes, by what was done with it. Ticked off, it glints first.
const away: Record<string, { transform: string; glint?: boolean }> = {
  done: { transform: 'translateY(-4px)', glint: true },
  // Back into orbit.
  snooze: { transform: 'translateY(-10px) scale(0.97)' },
  // Down onto the task list.
  task: { transform: 'translateY(6px)' },
  delete: { transform: 'translateX(12px)' },
};

const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px' };

function open(item: HTMLElement) {
  const style = getComputedStyle(item);
  return {
    height: `${item.offsetHeight}px`,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    borderTopWidth: style.borderTopWidth,
  };
}

function play(element: Element, frames: (item: HTMLElement) => Keyframe[], durationMs: number, done: () => void) {
  const item = element as HTMLElement;
  if (still.matches) return done();
  const keyframes = frames(item);
  item.style.overflow = 'hidden';
  item.style.boxSizing = 'border-box';
  item.animate(keyframes, { duration: durationMs, easing }).onfinish = () => {
    item.style.overflow = '';
    item.style.boxSizing = '';
    done();
  };
}

function enter(element: Element, done: () => void) {
  play(
    element,
    (item) => {
      const shown = open(item);
      return [
        { ...closed, opacity: 0, filter: 'blur(3px)', transform: 'translateY(4px)' },
        { ...shown, opacity: 0.35, filter: 'blur(2px)', transform: 'translateY(2px)', offset: 0.5 },
        { ...shown, opacity: 1, filter: 'blur(0)', transform: 'none' },
      ];
    },
    620,
    done,
  );
}

function leave(element: Element, done: () => void) {
  play(
    element,
    (item) => {
      const shown = open(item);
      const way = away[item.dataset.leave ?? ''] ?? away.delete!;
      return [
        { ...shown, opacity: 1, filter: 'brightness(1) blur(0)', transform: 'none' },
        { ...shown, opacity: 1, filter: `brightness(${way.glint ? 1.9 : 1}) blur(0)`, transform: 'none', offset: 0.2 },
        { ...shown, opacity: 0, filter: 'brightness(1) blur(4px)', transform: way.transform, offset: 0.6 },
        { ...closed, opacity: 0, filter: 'brightness(1) blur(4px)', transform: way.transform },
      ];
    },
    760,
    done,
  );
}
</script>

<template>
  <TransitionGroup :tag="tag ?? 'ul'" :css="false" @enter="enter" @leave="leave">
    <slot />
  </TransitionGroup>
</template>
