import { describe, expect, it } from 'vitest';
import { hotkeyFromPress, hotkeyLabel } from './hotkey';

const press = (code: string, held: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...held,
});

describe('hotkeys', () => {
  it('records a key press with its modifiers in the order they are saved', () => {
    expect(hotkeyFromPress(press('KeyP', { altKey: true }))).toBe('Alt+KeyP');
    expect(hotkeyFromPress(press('KeyK', { metaKey: true, shiftKey: true, ctrlKey: true }))).toBe(
      'Control+Shift+Super+KeyK',
    );
    expect(hotkeyFromPress(press('F5'))).toBe('F5');
  });

  it('waits while only modifiers are held', () => {
    for (const code of ['AltLeft', 'MetaRight', 'ShiftLeft', 'ControlRight', 'CapsLock', '']) {
      expect(hotkeyFromPress(press(code, { altKey: true }))).toBeUndefined();
    }
  });

  it('shows hotkeys the way each system does', () => {
    expect(hotkeyLabel('Alt+KeyP', true)).toBe('⌥P');
    expect(hotkeyLabel('Alt+KeyP', false)).toBe('Alt+P');
    expect(hotkeyLabel('Control+Alt+Shift+Super+Digit1', true)).toBe('⌃⌥⇧⌘1');
    expect(hotkeyLabel('Shift+Super+Space', false)).toBe('Shift+Win+Space');
    expect(hotkeyLabel('Control+Alt+Slash', true)).toBe('⌃⌥/');
    expect(hotkeyLabel('Alt+ArrowUp', false)).toBe('Alt+↑');
    expect(hotkeyLabel('Control+Alt+Numpad5', false)).toBe('Ctrl+Alt+Num 5');
  });
});
