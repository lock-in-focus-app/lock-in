import type { Directive } from 'vue';

// `v-tilt`: a glass card leans a little toward the pointer and lifts, as if it floats over the
// sky, with a sheen following the pointer. The look is the `.tilt` class in theme.css. Under
// reduced motion cards stay flat.

const still = window.matchMedia('(prefers-reduced-motion: reduce)');
/** How far a card leans at its edges, in degrees. Wide cards lean less sideways. */
const maxTilt = 4;
const listeners = new WeakMap<HTMLElement, { move: (event: PointerEvent) => void; leave: () => void }>();

export const vTilt: Directive<HTMLElement> = {
  mounted(card) {
    card.classList.add('card', 'tilt');
    const move = (event: PointerEvent) => {
      if (still.matches || event.pointerType !== 'mouse') return;
      const box = card.getBoundingClientRect();
      const across = (event.clientX - box.left) / box.width - 0.5;
      const down = (event.clientY - box.top) / box.height - 0.5;
      const sideways = maxTilt * Math.min(1, 160 / box.width);
      card.style.setProperty('--tilt-x', `${(across * 2 * sideways).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(-down * 2 * maxTilt).toFixed(2)}deg`);
      card.style.setProperty('--sheen-x', `${((across + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--sheen-y', `${((down + 0.5) * 100).toFixed(1)}%`);
    };
    const leave = () => {
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
      card.style.removeProperty('--sheen-x');
      card.style.removeProperty('--sheen-y');
    };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', leave);
    listeners.set(card, { move, leave });
  },
  unmounted(card) {
    const handlers = listeners.get(card);
    if (!handlers) return;
    card.removeEventListener('pointermove', handlers.move);
    card.removeEventListener('pointerleave', handlers.leave);
  },
};
