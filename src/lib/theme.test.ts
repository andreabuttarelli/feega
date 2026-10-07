import { describe, expect, it } from 'vitest';
import { ThemePref, htmlThemeAttrs, parseThemePref, resolvedTheme } from './theme';

describe('theme preference', () => {
  it('anything unknown is the system default', () => {
    expect(parseThemePref(undefined)).toBe(ThemePref.System);
    expect(parseThemePref('blue')).toBe(ThemePref.System);
    expect(parseThemePref('dark')).toBe(ThemePref.Dark);
  });

  it('a saved light or dark is set on the html by the server, so the first paint is right', () => {
    expect(htmlThemeAttrs(ThemePref.Dark)).toBe(' data-theme-pref="dark" data-theme="dark"');
    expect(htmlThemeAttrs(ThemePref.System)).toBe(' data-theme-pref="system"');
  });

  it('system follows the OS', () => {
    expect(resolvedTheme(ThemePref.System, true)).toBe('dark');
    expect(resolvedTheme(ThemePref.System, false)).toBe('light');
    expect(resolvedTheme(ThemePref.Light, true)).toBe('light');
  });
});
