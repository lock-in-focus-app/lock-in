// A cover over a tab on a redirected site that's still open after its pass ran out, or
// that was open before the session started, and over any open tab on a restricted site. It lives in a shadow root so the
// site's styles can't change it.

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
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  /* A dark tint rather than a blur, so a busy page underneath doesn't cost anything. */
  background:
    radial-gradient(120% 60% at 50% 115%, rgb(120 92 150 / 0.22), transparent 70%),
    color-mix(in srgb, var(--sky) 92%, transparent);
  font: 14px/1.4 system-ui, -apple-system, sans-serif;
  color: var(--starlight);
  color-scheme: dark;
}
.card {
  box-sizing: border-box;
  width: min(400px, calc(100vw - 32px));
  padding: 22px 22px 20px;
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
    rgb(8 11 22 / 0.9);
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
}
.brand { margin: 0 0 18px; font: 10px/1.5 var(--mono); letter-spacing: 0.22em; text-transform: uppercase; }
.star { color: var(--glow); }
h1 { margin: 0; font-size: 22px; font-weight: 300; line-height: 1.25; }
p.body { margin: 8px 0 20px; color: var(--dim); }
.actions { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: 8px; }
button {
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: none;
  font: 11px/1.5 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 300ms, border-color 300ms;
}
.close {
  border-color: color-mix(in srgb, var(--glow) 55%, transparent);
  background: color-mix(in srgb, var(--glow) 8%, transparent);
  color: var(--glow);
  text-shadow: 0 0 8px color-mix(in srgb, var(--glow) 50%, transparent);
}
.close:hover { border-color: var(--glow); }
.still { color: var(--dim); }
.still:hover { border-color: rgb(220 228 255 / 0.3); color: var(--starlight); }
button:focus-visible { outline: 1px solid #cfe0ff; outline-offset: 2px; }
`;

export interface PauseOverlayOptions {
  siteName: string;
  profileName: string;
  /** Why the tab is covered: its pass ran out, it was open before the session, or the site is restricted. */
  reason: 'expired' | 'open-before' | 'restricted';
  /** Leave out for restricted sites, which have no way through. */
  onStillNeed?: () => void;
  onClose: () => void;
}

const copy = {
  expired: (o: PauseOverlayOptions) => ({
    title: `Your pass for ${o.siteName} ran out`,
    body: "Still need it? You'll go back through the redirect page's wait first.",
  }),
  'open-before': (o: PauseOverlayOptions) => ({
    title: `${o.siteName} is paused for now`,
    body: `This tab was open before ${o.profileName} started.`,
  }),
  restricted: (o: PauseOverlayOptions) => ({
    title: `${o.siteName} is off for now`,
    body: `It's restricted during ${o.profileName} and will be back when the session ends.`,
  }),
};

/** Covers the page and pauses any media. Returns a function that removes the cover. */
export function showPauseOverlay(options: PauseOverlayOptions): () => void {
  const host = document.createElement('lock-in-pause');
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = css;

  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'title');

  const brand = element('p', 'brand', `Lock In · ${options.profileName}`);
  brand.prepend(element('span', 'star', '✦ '));
  const text = copy[options.reason](options);
  const title = element('h1', '', text.title);
  title.id = 'title';
  const body = element('p', 'body', text.body);

  const close = element('button', 'close', 'Close tab');
  close.addEventListener('click', options.onClose);
  const actions = element('div', 'actions');
  if (options.onStillNeed) {
    const still = element('button', 'still', 'Still need it');
    still.addEventListener('click', options.onStillNeed);
    actions.append(still);
  }
  actions.append(close);

  card.append(brand, title, body, actions);
  root.append(style, card);
  document.documentElement.append(host);
  close.focus();

  for (const media of document.querySelectorAll('audio, video')) (media as HTMLMediaElement).pause();

  return () => host.remove();
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
