// The "pause" for a redirected site: a cover over a tab that's still open after its pass
// ran out, or that was open before the session started. It lives in a shadow root so the
// site's styles can't change it.

const css = `
:host {
  /* Mirrors the tokens in assets/theme.css. */
  --sky: #0b1020;
  --sky-raised: #151b31;
  --sky-hover: #1e2643;
  --starlight: #f3f0e6;
  --dim: #9aa3bf;
  --glow: #f5c86b;
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--sky) 82%, transparent);
  backdrop-filter: blur(6px) grayscale(1);
  font: 14px/1.4 system-ui, -apple-system, sans-serif;
  color: var(--starlight);
  color-scheme: dark;
}
.card {
  box-sizing: border-box;
  width: min(380px, calc(100vw - 32px));
  padding: 24px;
  border-radius: 16px;
  background: var(--sky);
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
}
.brand { margin: 0 0 16px; color: var(--dim); font-size: 13px; }
.star { color: var(--glow); }
h1 { margin: 0; font-size: 22px; font-weight: 500; line-height: 1.25; }
p.body { margin: 8px 0 20px; color: var(--dim); }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
button { padding: 11px; border: 0; border-radius: 10px; font: inherit; cursor: pointer; }
.close { background: var(--glow); color: var(--sky); font-weight: 600; }
.still { background: var(--sky-raised); color: var(--starlight); }
.still:hover { background: var(--sky-hover); }
button:focus-visible { outline: 2px solid var(--glow); outline-offset: 2px; }
`;

export interface PauseOverlayOptions {
  siteName: string;
  profileName: string;
  passExpired: boolean;
  onStillNeed: () => void;
  onClose: () => void;
}

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

  const brand = element('p', 'brand', ` Lock In · ${options.profileName}`);
  brand.prepend(element('span', 'star', '✦'));
  const title = element(
    'h1',
    '',
    options.passExpired ? `Your pass for ${options.siteName} ran out` : `${options.siteName} is paused for now`,
  );
  title.id = 'title';
  const body = element(
    'p',
    'body',
    options.passExpired
      ? "Still need it? You'll go back through the gate first."
      : `This tab was open before ${options.profileName} started.`,
  );

  const still = element('button', 'still', 'Still need it');
  still.addEventListener('click', options.onStillNeed);
  const close = element('button', 'close', 'Close tab');
  close.addEventListener('click', options.onClose);
  const actions = element('div', 'actions');
  actions.append(still, close);

  card.append(brand, title, body, actions);
  root.append(style, card);
  document.documentElement.append(host);
  close.focus();

  for (const media of document.querySelectorAll('audio, video')) (media as HTMLMediaElement).pause();

  return () => host.remove();
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}
