import type { HiddenPart } from '@lock-in/core';

// The element picker: a small panel on the real page, started from the popup, for hiding parts of
// a site while it's tamed. Clicking part of the page picks it (outlined, with the page's own
// clicks held back), then the panel spells out what to do with it: hide it, pick the bigger part
// around it, or pick again. What's hidden is listed with a way to show each one again. It lives in
// a shadow root, like the pause cover, so the site's styles can't change it (shadowHost.ts).

const css = `
:host {
  /* Mirrors the tokens and frame in assets/theme.css (the app's Observatory HUD). */
  --sky: #0b1020;
  --starlight: #f3f0e6;
  --dim: #a9b1cc;
  --faint: #7c84a3;
  --glow: #f5c86b;
  --line: rgb(220 228 255 / 0.1);
  --t: color-mix(in srgb, #dce4ff 55%, transparent);
  --mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
  all: initial;
  /* Its place over the page is pinned by shadowHost(). */
  pointer-events: none;
  font: 13px/1.45 system-ui, -apple-system, sans-serif;
  color: var(--starlight);
  color-scheme: dark;
}
.box {
  position: fixed;
  display: none;
  box-sizing: border-box;
  border-radius: 3px;
  pointer-events: none;
}
.box.pointing {
  /* A mid blue, with a dark edge, so it shows on light pages and dark ones. */
  outline: 2px dashed #8fa8ff;
  background: rgb(143 168 255 / 0.12);
  box-shadow: 0 0 0 1px rgb(11 16 32 / 0.45);
}
.box.picked {
  outline: 2px solid var(--glow);
  background: color-mix(in srgb, var(--glow) 12%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--glow) 35%, transparent);
}
.panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  box-sizing: border-box;
  width: min(320px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 14px 14px 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background:
    linear-gradient(var(--t), var(--t)) top left / 9px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) top left / 1px 9px no-repeat,
    linear-gradient(var(--t), var(--t)) top right / 9px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) top right / 1px 9px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom left / 9px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom left / 1px 9px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom right / 9px 1px no-repeat,
    linear-gradient(var(--t), var(--t)) bottom right / 1px 9px no-repeat,
    rgb(8 11 22 / 0.94);
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.5);
  pointer-events: auto;
  animation: rise 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes rise {
  from { opacity: 0; translate: 0 12px; }
}
.mono { margin: 0; font: 10px/1.5 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); }
.mono b { color: var(--dim); font-weight: 500; }
.star { color: var(--glow); }
.say { margin: 8px 0 0; color: var(--dim); }
.say q { color: var(--starlight); }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
button {
  flex: 1 1 auto;
  padding: 7px 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: none;
  color: var(--dim);
  font: 9.5px/1.5 var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 300ms, border-color 300ms;
}
button:hover:not(:disabled) { color: var(--starlight); border-color: rgb(220 228 255 / 0.3); }
button:disabled { cursor: default; opacity: 0.4; }
button.lit {
  border-color: color-mix(in srgb, var(--glow) 55%, transparent);
  background: color-mix(in srgb, var(--glow) 8%, transparent);
  color: var(--glow);
}
button.lit:hover { border-color: var(--glow); color: var(--glow); }
button:focus-visible { outline: 1px solid #cfe0ff; outline-offset: 2px; }
.list { margin: 12px 0 0; padding: 10px 0 0; border-top: 1px dashed var(--line); }
ul { display: grid; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
li { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--starlight); }
li button { flex: none; padding: 3px 6px; }
.note { margin: 8px 0 0; color: var(--faint); font-size: 12px; }
.footer { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.footer .note { flex: 1; margin: 0; }
.footer button { flex: none; padding: 7px 14px; }
@media (prefers-reduced-motion: reduce) {
  .panel { animation: none; }
}
`;

export interface PickerOptions {
  siteName: string;
  profileName: string;
  /** What's hidden on this site now, read again whenever the panel redraws. */
  hidden: () => readonly HiddenPart[];
  /** Whether a Hard session of the profile is running, so parts can be hidden but not shown again. */
  locked: () => boolean;
  /** Turns a picked element into a part to keep, or undefined when it can't be pointed at safely. */
  partFor: (element: Element) => HiddenPart | undefined;
  /** The element someone means by clicking this one, or undefined for the whole page. */
  pickable: (target: Element) => Element | undefined;
  onHide: (part: HiddenPart) => Promise<void>;
  onShow: (selector: string) => Promise<void>;
  onDone: () => void;
}

export interface Picker {
  /** Redraws the panel, as what's hidden changes. */
  refresh(): void;
  close(): void;
}

/** Events the page doesn't get while picking, so a click picks instead of following a link. */
const heldBack = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu'];

export function showPicker(options: PickerOptions): Picker {
  const { host, root } = shadowHost('lock-in-picker');
  const style = document.createElement('style');
  style.textContent = css;
  const pointingBox = element('div', 'box pointing');
  const pickedBox = element('div', 'box picked');
  const panel = element('section', 'panel');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `Hide parts of ${options.siteName}`);
  root.append(style, pointingBox, pickedBox, panel);
  document.documentElement.append(host);

  let pointing: Element | undefined;
  let picked: Element | undefined;
  let problem = '';

  const place = (box: HTMLElement, target: Element | undefined) => {
    if (!target?.isConnected) {
      box.style.display = 'none';
      return;
    }
    const rect = target.getBoundingClientRect();
    Object.assign(box.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };
  const placeBoxes = () => {
    place(pointingBox, pointing === picked ? undefined : pointing);
    place(pickedBox, picked);
  };

  function draw() {
    const brand = element('p', 'mono');
    brand.append(element('span', 'star', '✦ '), 'Lock In · Hiding on ', element('b', '', options.siteName));

    const children: Node[] = [brand];
    if (picked) {
      const say = element('p', 'say', 'Picked: ');
      say.append(element('q', '', options.partFor(picked)?.label ?? 'this part'));
      const hide = button('Hide it', 'lit hide', () => void hidePicked());
      const bigger = button('Pick the bigger part', 'bigger', () => {
        const parent = picked?.parentElement ? options.pickable(picked.parentElement) : undefined;
        if (parent) pick(parent);
      });
      bigger.disabled = !picked.parentElement || !options.pickable(picked.parentElement);
      const again = button('Pick again', 'again', () => pick(undefined));
      const actions = element('div', 'actions');
      actions.append(hide, bigger, again);
      children.push(say, actions);
      if (problem) children.push(element('p', 'note', problem));
      else if (coversMostOfPage(picked)) {
        children.push(
          element('p', 'note', `That's most of the page, so hiding it hides nearly all of ${options.siteName}.`),
        );
      }
    } else {
      children.push(element('p', 'say', 'Click any part of the page to pick it. Links and buttons wait until Done.'));
    }

    const hidden = options.hidden();
    if (hidden.length) {
      const list = element('div', 'list');
      const heading = element('p', 'mono', 'Hidden here · ');
      heading.append(element('b', '', String(hidden.length)));
      const items = element('ul', '');
      for (const part of hidden) {
        const item = element('li', '');
        const name = element('span', '', part.label || part.selector);
        name.title = part.selector;
        const show = button('Show again', 'show', () => void options.onShow(part.selector));
        show.disabled = options.locked();
        show.setAttribute('aria-label', `Show ${part.label || part.selector} again`);
        item.append(name, show);
        items.append(item);
      }
      list.append(heading, items);
      if (options.locked())
        list.append(element('p', 'note', 'During this Hard session, parts can be hidden but not shown again.'));
      children.push(list);
    }

    const footer = element('div', 'footer');
    footer.append(
      element('p', 'note', `Saved to ${options.profileName}, and hidden whenever it tames ${options.siteName}.`),
      button('Done', 'lit done', () => options.onDone()),
    );
    children.push(footer);
    panel.replaceChildren(...children);
    placeBoxes();
  }

  function pick(target: Element | undefined) {
    picked = target;
    problem = '';
    draw();
  }

  async function hidePicked() {
    if (!picked) return;
    const part = options.partFor(picked);
    if (!part) {
      problem = "Lock In can't point at this part on its own. Try the bigger part.";
      draw();
      return;
    }
    const target = picked;
    picked = undefined;
    placeBoxes();
    // A quick fade before the saved rule hides it for good.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await target
        .animate([{ opacity: 1 }, { opacity: 0, scale: '0.98' }], { duration: 220, easing: 'ease-out' })
        .finished.catch(() => {});
    }
    await options.onHide(part);
    draw();
  }

  const ours = (event: Event) => event.composedPath().includes(host);
  const holdBack = (event: Event) => {
    if (ours(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'click' && event.target instanceof Element) {
      const target = options.pickable(event.target);
      if (target) pick(target);
    }
  };
  const point = (event: MouseEvent) => {
    pointing = ours(event) || !(event.target instanceof Element) ? undefined : options.pickable(event.target);
    placeBoxes();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    if (picked) pick(undefined);
    else options.onDone();
  };
  let frame = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(placeBoxes);
  };

  for (const type of heldBack) window.addEventListener(type, holdBack, true);
  window.addEventListener('mousemove', point, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', follow);
  draw();
  panel.querySelector('button')?.focus();

  return {
    refresh: draw,
    close() {
      for (const type of heldBack) window.removeEventListener(type, holdBack, true);
      window.removeEventListener('mousemove', point, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      cancelAnimationFrame(frame);
      host.remove();
    },
  };
}

/** Whether an element takes up most of the window, like the box a whole site sits in. */
function coversMostOfPage(target: Element): boolean {
  const rect = target.getBoundingClientRect();
  const width = Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
  const height = Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
  return width > 0 && height > 0 && width * height >= 0.8 * innerWidth * innerHeight;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const el = element('button', className, text);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}
