// The satellite box's hotkey, saved as text like "Alt+KeyP": the modifiers, then the key by its
// `KeyboardEvent.code` name. The desktop app's hotkey.rs reads it, and decides whether it can be
// used; this records it from a key press and shows it.

/** The keys held with a key press, as a `KeyboardEvent` has them. */
export interface KeyPress {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

// In the order a Mac shows them (⌃⌥⇧⌘), which is also the order they're saved in.
const modifiers = [
  { name: 'Control', held: (press: KeyPress) => press.ctrlKey, mac: '⌃', other: 'Ctrl' },
  { name: 'Alt', held: (press: KeyPress) => press.altKey, mac: '⌥', other: 'Alt' },
  { name: 'Shift', held: (press: KeyPress) => press.shiftKey, mac: '⇧', other: 'Shift' },
  { name: 'Super', held: (press: KeyPress) => press.metaKey, mac: '⌘', other: 'Win' },
];

// Keys that only change other keys, which can't be a hotkey's key.
const modifierKey = /^(Shift|Control|Alt|Meta|OS|Fn|CapsLock)/;

const keyNames: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** The hotkey a key press makes, or nothing while only modifiers are held. */
export function hotkeyFromPress(press: KeyPress): string | undefined {
  if (!press.code || modifierKey.test(press.code)) return undefined;
  return [...modifiers.filter((modifier) => modifier.held(press)).map((modifier) => modifier.name), press.code].join(
    '+',
  );
}

/** How a hotkey is shown: "⌥P" on a Mac, "Alt+P" elsewhere. */
export function hotkeyLabel(hotkey: string, mac: boolean): string {
  const parts = hotkey.split('+');
  const code = parts.pop() ?? '';
  const key = keyNames[code] ?? code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
  const held = modifiers.filter((modifier) => parts.includes(modifier.name));
  return mac
    ? [...held.map((modifier) => modifier.mac), key].join('')
    : [...held.map((modifier) => modifier.other), key].join('+');
}
