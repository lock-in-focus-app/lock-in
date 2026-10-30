import { isSafeSelector, maxSelectorLength, type HiddenPart } from '@lock-in/core';

// Turns a part of a page someone picked with the element picker into a CSS selector, so it can be
// hidden whenever the site is tamed. Sites rebuild their pages and rename generated class names
// often, so the selector leans on what they keep stable (ids, test ids, labels, roles and plain
// class names) before position, and is checked to find the picked element and nothing else.

/** Test ids sites put in for their own browser tests, which rarely change. */
const testAttributes = ['data-testid', 'data-test-id', 'data-e2e', 'data-test', 'data-qa'];

/** A class or id that reads like a name someone chose, not one a build tool made up, like "css-1dbjc4n". */
const chosenName = (name: string) =>
  name.length <= 40 && /^[a-z]+(?:[-_]{1,2}[a-z]+)*$/i.test(name) && !/[a-z][A-Z][a-z]?[A-Z]/.test(name);

/** An attribute's value that can go between quotes in a selector as it is. */
const plainValue = (value: string | null): value is string =>
  !!value && value.length <= 80 && !/["\\\n{};@]|\/\*/.test(value);

/** Whether a selector finds this element and no other. */
function findsOnly(selector: string, element: Element): boolean {
  try {
    const found = document.querySelectorAll(selector);
    return found.length === 1 && found[0] === element;
  } catch {
    return false;
  }
}

/** The most telling way to name one element on its own, and whether it's unique on the page. */
function describe(element: Element): { css: string; unique: boolean } {
  const tag = element.localName;
  if (element.id && chosenName(element.id) && findsOnly(`#${element.id}`, element)) {
    return { css: `#${element.id}`, unique: true };
  }
  for (const name of [...testAttributes, 'aria-label']) {
    const value = element.getAttribute(name);
    if (plainValue(value)) return { css: `${tag}[${name}="${value}"]`, unique: false };
  }
  const classes = [...element.classList].filter(chosenName).slice(0, 2);
  if (classes.length) return { css: `${tag}.${classes.join('.')}`, unique: false };
  const role = element.getAttribute('role');
  if (plainValue(role)) return { css: `${tag}[role="${role}"]`, unique: false };
  return { css: tag, unique: false };
}

/** Its place among the siblings that share its tag, for when nothing else tells it apart. */
function position(element: Element): string {
  const same = [...(element.parentElement?.children ?? [])].filter((e) => e.localName === element.localName);
  return same.length > 1 ? `:nth-of-type(${same.indexOf(element) + 1})` : '';
}

/**
 * A selector that finds this element and nothing else, or undefined if there isn't a safe one.
 * It tries each ancestor's description in turn (`main > aside.trending`), then adds positions.
 */
export function selectorFor(element: Element): string | undefined {
  const root = document.body;
  const chain = (withPositions: boolean) => {
    const parts: string[] = [];
    for (let at: Element | null = element; at && at !== root && at !== document.documentElement;) {
      const { css, unique } = describe(at);
      parts.unshift(withPositions && !unique ? css + position(at) : css);
      const selector = parts.join(' > ');
      if (findsOnly(selector, element)) return selector;
      if (unique || parts.length >= 12) return undefined;
      at = at.parentElement;
    }
    const selector = ['body', ...parts].join(' > ');
    return findsOnly(selector, element) ? selector : undefined;
  };
  const selector = chain(false) ?? chain(true);
  return selector && selector.length <= maxSelectorLength && isSafeSelector(selector) ? selector : undefined;
}

/** What to call a few kinds of element that have no words of their own. */
const kinds: Record<string, string> = {
  nav: 'Navigation',
  aside: 'Sidebar',
  header: 'Header',
  footer: 'Footer',
  img: 'An image',
  picture: 'An image',
  video: 'A video',
  iframe: 'An embedded frame',
  svg: 'An icon',
  button: 'A button',
  a: 'A link',
};

/** A short name for a picked part, for the list of what's hidden: its label, heading or first words. */
export function labelFor(element: Element): string {
  const words = (text: string | null | undefined) => text?.trim().split('\n')[0]?.trim() ?? '';
  // Sites built from web components, like Reddit, keep words inside their own shadow roots.
  const inside = (selector: string) => element.querySelector(selector) ?? element.shadowRoot?.querySelector(selector);
  const named = inside('[aria-label], [placeholder], [title]');
  const text =
    words(element.getAttribute('aria-label')) ||
    words(inside('h1, h2, h3, h4, [role="heading"]')?.textContent) ||
    words(element instanceof HTMLElement ? element.innerText : element.textContent) ||
    words(element.getAttribute('title')) ||
    words(named?.getAttribute('aria-label') || named?.getAttribute('placeholder') || named?.getAttribute('title'));
  if (text) return text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text;
  return kinds[element.localName] ?? 'A part of the page';
}

/** The part someone means when they click an element: a whole icon rather than one of its lines. */
export function pickable(target: Element): Element | undefined {
  const element = target.closest('svg') ?? target;
  return element === document.body || element === document.documentElement ? undefined : element;
}

/** A picked part, ready to keep. Undefined when there's no safe selector for it. */
export function hiddenPartFor(element: Element): HiddenPart | undefined {
  const selector = selectorFor(element);
  return selector ? { selector, label: labelFor(element) } : undefined;
}
