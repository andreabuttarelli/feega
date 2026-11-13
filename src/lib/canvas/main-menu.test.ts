import { describe, expect, it } from 'vitest';
import { ThemePref } from '$lib/theme';
import { THEME_CHOICES } from './main-menu';

describe('main menu model', () => {
  it('offers light, dark and system in that order', () => {
    expect(THEME_CHOICES).toEqual([ThemePref.Light, ThemePref.Dark, ThemePref.System]);
  });
});
