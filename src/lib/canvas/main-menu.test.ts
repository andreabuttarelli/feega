import { describe, expect, it } from 'vitest';
import { Command } from '$lib/motion/shortcuts';
import { ThemePref } from '$lib/theme';
import { PREFERENCE_ITEMS, THEME_CHOICES, preferenceShortcut } from './main-menu';

describe('main menu model', () => {
  it('preferences lists the rulers toggle on the same command as the shortcut', () => {
    expect(PREFERENCE_ITEMS.map((i) => i.command)).toContain(Command.ToggleRulers);
  });

  it('shows the shortcut the keyboard uses', () => {
    expect(preferenceShortcut(Command.ToggleRulers)).toBe('⌥⇧R');
  });

  it('offers light, dark and system in that order', () => {
    expect(THEME_CHOICES).toEqual([ThemePref.Light, ThemePref.Dark, ThemePref.System]);
  });
});
