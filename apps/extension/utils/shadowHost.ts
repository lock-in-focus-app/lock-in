// Lock In's own things on a site's page (the pause cover and the element picker) live in a shadow
// root, so the site's styles can't reach inside. The element holding it is still part of the
// page, though, and some sites hide elements like it: Reddit hides every custom element that
// isn't registered yet (`:not(:defined)`), and a content script can't register one. So the
// holder's place on the page is pinned in its own style attribute with !important, which no
// stylesheet on the page can override.

/** A fixed layer over the whole page, holding a shadow root. Add it to the page once it's filled. */
export function shadowHost(tag: string, display: 'block' | 'grid' = 'block'): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement(tag);
  const pinned: Record<string, string> = {
    display,
    visibility: 'visible',
    opacity: '1',
    position: 'fixed',
    inset: '0',
    'z-index': '2147483647',
    margin: '0',
    transform: 'none',
    filter: 'none',
    'clip-path': 'none',
  };
  for (const [property, value] of Object.entries(pinned)) host.style.setProperty(property, value, 'important');
  return { host, root: host.attachShadow({ mode: 'open' }) };
}
