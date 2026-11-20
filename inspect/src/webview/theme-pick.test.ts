import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '@feega/live-edit/themes';
import { stillThere, themeBadge, writtenTheme } from './theme-pick';

const THEMES = [DEFAULT_THEME, 'dark'];

describe('the theme chosen in the toolbar', () => {
  it('writes nothing for the default theme', () => {
    expect(writtenTheme(DEFAULT_THEME)).toBeUndefined();
  });

  it('writes the chosen theme', () => {
    expect(writtenTheme('dark')).toBe('dark');
  });

  it('shows no badge on default and the name otherwise', () => {
    expect(themeBadge(DEFAULT_THEME)).toBeNull();
    expect(themeBadge('dark')).toBe('theme: dark');
  });

  it('falls back to default when the project stops having the theme', () => {
    expect(stillThere(THEMES, 'dark')).toBe('dark');
    expect(stillThere(THEMES, 'forest')).toBe(DEFAULT_THEME);
  });
});
