import type { HiddenPart } from '@lock-in/core';

// The element picker: a small panel on the real page, started from the popup, for hiding parts of
// a site while it's tamed. Clicking part of the page hides it straight away (the page's own clicks
// are held back), so you see what the site will look like. Each part picked this time is listed
// with Bigger and Undo, and ones hidden before with Show again. Nothing is saved until Done, and
// Cancel puts everything back. It lives in
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
li > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--starlight); }
li.shown > span:first-child { color: var(--faint); text-decoration: line-through; }
li.note { display: block; margin: -2px 0 2px; }
.keys { display: flex; flex: none; gap: 4px; }
.keys button { padding: 3px 6px; }
.note { margin: 8px 0 0; color: var(--faint); font-size: 12px; }
.footer { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.footer .note { margin: 0; }
.end { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
.end button { flex: none; padding: 7px 14px; }
.problem { color: var(--glow); }
@media (prefers-reduced-motion: reduce) {
  .panel { animation: none; }
}
`;

export interface PickerOptions {
  siteName: string;
  profileName: string;
  /** What's saved as hidden on this site now, read again whenever the panel redraws. */
  saved: () => readonly HiddenPart[];
  /** Whether a Hard session of the profile is running, so parts can be hidden but not shown again. */
  locked: () => boolean;
  /** The most parts one site can have hidden. */
  maxParts: number;
  /** Turns a picked element into a part to keep, or undefined when it can't be pointed at safely. */
  partFor: (element: Element) => HiddenPart | undefined;
  /** The element someone means by clicking this one, or undefined for the whole page. */
  pickable: (target: Element) => Element | undefined;
  /** Hides these parts on the page right now, as a preview of what Done would save. */
  preview: (parts: HiddenPart[]) => void;
  /** Saves the parts picked this time, and the saved ones to show again. */
  onDone: (change: { add: HiddenPart[]; remove: string[] }) => void;
  /** Closes without saving anything. */
  onCancel: () => void;
}

export interface Picker {
  /** Redraws the panel, as what's saved changes. */
  refresh(): void;
  close(): void;
}

/** A part picked this time: hidden on the page already, saved once Done is clicked. */
interface Draft {
  element: Element;
  part: HiddenPart;
  /** Whether it's most of the page, which is worth saying since the page goes nearly blank. */
  big: boolean;
}

/** Events the page doesn't get while picking, so a click picks instead of following a link. */
const heldBack = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu'];

export function showPicker(options: PickerOptions): Picker {
  const { host, root } = shadowHost('lock-in-picker');
  const style = document.createElement('style');
  style.textContent = css;
  const pointingBox = element('div', 'box pointing');
  const panel = element('section', 'panel');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `Hide parts of ${options.siteName}`);
  root.append(style, pointingBox, panel);
  document.documentElement.append(host);

  let pointing: Element | undefined;
  let drafts: Draft[] = [];
  /** Saved parts to show again once Done is clicked. */
  const showing = new Set<string>();
  let problem = '';

  const changed = () => drafts.length > 0 || showing.size > 0;
  const taken = (selector: string) =>
    drafts.some((d) => d.part.selector === selector) || options.saved().some((p) => p.selector === selector);

  const placePointing = () => {
    const target = pointing?.isConnected ? pointing : undefined;
    const rect = target?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      pointingBox.style.display = 'none';
      return;
    }
    Object.assign(pointingBox.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };

  function draw() {
    const saved = options.saved();
    const locked = options.locked();
    // Showing again isn't allowed during a Hard session, even if it was marked before one started.
    if (locked) showing.clear();
    options.preview([...saved.filter((p) => !showing.has(p.selector)), ...drafts.map((d) => d.part)]);

    const brand = element('p', 'mono');
    brand.append(element('span', 'star', '✦ '), 'Lock In · Hiding on ', element('b', '', options.siteName));
    const children: Node[] = [
      brand,
      element('p', 'say', 'Click anything on the page to hide it. Nothing is saved until Done.'),
    ];
    if (problem) children.push(element('p', 'note problem', problem));

    if (drafts.length) {
      const list = section('Hiding now', drafts.length);
      for (const draft of drafts) {
        const bigger = button('Bigger', 'bigger', () => widen(draft));
        const parent = draft.element.parentElement;
        bigger.disabled = !parent || !options.pickable(parent);
        bigger.setAttribute('aria-label', `Hide the bigger part around ${draft.part.label}`);
        const undo = button('Undo', 'undo', () => {
          drafts = drafts.filter((d) => d !== draft);
          problem = '';
          draw();
        });
        undo.setAttribute('aria-label', `Undo hiding ${draft.part.label}`);
        list.items.append(item(draft.part, [bigger, undo]));
        if (draft.big) {
          list.items.append(
            element('li', 'note', `That's most of the page, so it hides nearly all of ${options.siteName}.`),
          );
        }
      }
      children.push(list.frame);
    }

    if (saved.length) {
      const list = section('Hidden before', saved.length);
      for (const part of saved) {
        const shown = showing.has(part.selector);
        const name = part.label || part.selector;
        const toggle = shown
          ? button('Keep hidden', 'keep', () => {
              showing.delete(part.selector);
              draw();
            })
          : button('Show again', 'show', () => {
              showing.add(part.selector);
              draw();
            });
        toggle.disabled = locked;
        toggle.setAttribute('aria-label', `${shown ? 'Keep' : 'Show'} ${name} ${shown ? 'hidden' : 'again'}`);
        const row = item(part, [toggle]);
        row.classList.toggle('shown', shown);
        list.items.append(row);
      }
      if (locked) {
        list.frame.append(element('p', 'note', 'During this Hard session, parts can be hidden but not shown again.'));
      }
      children.push(list.frame);
    }

    const footer = element('div', 'footer');
    footer.append(
      element(
        'p',
        'note',
        changed()
          ? `Done saves this to ${options.profileName}. It's hidden whenever ${options.profileName} tames ${options.siteName}.`
          : `Saved to ${options.profileName}. It's hidden whenever ${options.profileName} tames ${options.siteName}.`,
      ),
    );
    const buttons = element('div', 'end');
    buttons.append(
      button('Cancel', 'cancel', () => options.onCancel()),
      button('Done', 'lit done', () => options.onDone({ add: drafts.map((d) => d.part), remove: [...showing] })),
    );
    footer.append(buttons);
    children.push(footer);
    panel.replaceChildren(...children);
    placePointing();
  }

  /** Hides a clicked part straight away, after a quick fade. */
  async function pick(target: Element) {
    problem = '';
    const part = options.partFor(target);
    if (!part) problem = "Lock In can't point at that part on its own. Try clicking around it.";
    else if (taken(part.selector)) return;
    else if (options.saved().length + drafts.length >= options.maxParts) {
      problem = `That's the most one site can hide (${options.maxParts}).`;
    }
    if (problem || !part) {
      draw();
      return;
    }
    const big = coversMostOfPage(target);
    pointing = undefined;
    placePointing();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await target
        .animate([{ opacity: 1 }, { opacity: 0, scale: '0.98' }], { duration: 180, easing: 'ease-out' })
        .finished.catch(() => {});
    }
    // Picking a part around ones picked already takes their place.
    drafts = [...drafts.filter((d) => !target.contains(d.element)), { element: target, part, big }];
    draw();
  }

  /** Swaps a picked part for the bigger part around it. */
  function widen(draft: Draft) {
    const parent = draft.element.parentElement ? options.pickable(draft.element.parentElement) : undefined;
    const part = parent && options.partFor(parent);
    problem = '';
    if (!parent || !part) {
      problem = "Lock In can't point at the part around that one on its own.";
    } else {
      // Its size is read while it's still shown, before the preview hides it again.
      const others = drafts.filter((d) => d !== draft && !parent.contains(d.element));
      drafts = others;
      options.preview([...options.saved().filter((p) => !showing.has(p.selector)), ...others.map((d) => d.part)]);
      const big = coversMostOfPage(parent);
      if (!taken(part.selector)) drafts = [...others, { element: parent, part, big }];
    }
    draw();
  }

  const ours = (event: Event) => event.composedPath().includes(host);
  const holdBack = (event: Event) => {
    if (ours(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'click' && event.target instanceof Element) {
      const target = options.pickable(event.target);
      if (target) void pick(target);
    }
  };
  const point = (event: MouseEvent) => {
    pointing = ours(event) || !(event.target instanceof Element) ? undefined : options.pickable(event.target);
    placePointing();
  };
  // Esc closes the picker when there's nothing to lose; with picks in it, Cancel says so plainly.
  const key = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || changed()) return;
    event.stopImmediatePropagation();
    options.onCancel();
  };
  let frame = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(placePointing);
  };

  for (const type of heldBack) window.addEventListener(type, holdBack, true);
  window.addEventListener('mousemove', point, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', follow);
  draw();

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

/** A titled list in the panel, like "Hiding now · 2". */
function section(title: string, count: number) {
  const frame = element('div', 'list');
  const heading = element('p', 'mono', `${title} · `);
  heading.append(element('b', '', String(count)));
  const items = element('ul', '');
  frame.append(heading, items);
  return { frame, items };
}

/** One part in a list: its name, with the selector on hover, then its buttons. */
function item(part: HiddenPart, buttons: HTMLButtonElement[]): HTMLLIElement {
  const row = element('li', '');
  const name = element('span', '', part.label || part.selector);
  name.title = part.selector;
  const keys = element('span', 'keys');
  keys.append(...buttons);
  row.append(name, keys);
  return row;
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
