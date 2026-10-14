import { describe, expect, it } from 'vitest';
import { Platform, shortcutKeys, shortcutText } from './shortcut';

describe('a shortcut reads the way the keyboard under the hand is labelled', () => {
  it('on a Mac, modifiers are the glyphs printed on the keys', () => {
    expect(shortcutKeys('Mod+Shift+Z', Platform.Mac)).toEqual(['⌘', '⇧', 'Z']);
    expect(shortcutKeys('Alt+Backspace', Platform.Mac)).toEqual(['⌥', '⌫']);
  });

  it('elsewhere, modifiers are spelled out', () => {
    expect(shortcutKeys('Mod+Shift+Z', Platform.Other)).toEqual(['Ctrl', 'Shift', 'Z']);
  });

  it('a single letter is shown upper case, a named key stays readable', () => {
    expect(shortcutKeys('r', Platform.Mac)).toEqual(['R']);
    expect(shortcutKeys('Escape', Platform.Other)).toEqual(['Esc']);
    expect(shortcutKeys('Space', Platform.Mac)).toEqual(['Space']);
  });

  it('as text, Mac glyphs run together and words are joined by +', () => {
    expect(shortcutText('Mod+K', Platform.Mac)).toBe('⌘K');
    expect(shortcutText('Mod+K', Platform.Other)).toBe('Ctrl+K');
  });
});
