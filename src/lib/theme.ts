export enum ThemePref {
  System = 'system',
  Light = 'light',
  Dark = 'dark'
}

export type Theme = ThemePref.Light | ThemePref.Dark;

export const THEME_PREFS = Object.values(ThemePref) as [ThemePref, ...ThemePref[]];
export const THEME_COOKIE = 'theme';
export const THEME_METADATA_KEY = 'theme';
export const THEME_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

export const THEME_LABEL: Record<ThemePref, string> = {
  [ThemePref.System]: 'System',
  [ThemePref.Light]: 'Light',
  [ThemePref.Dark]: 'Dark'
};

export function parseThemePref(value: unknown): ThemePref {
  return THEME_PREFS.includes(value as ThemePref) ? (value as ThemePref) : ThemePref.System;
}

export function resolvedTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref !== ThemePref.System) {
    return pref;
  }
  return systemDark ? ThemePref.Dark : ThemePref.Light;
}

export function htmlThemeAttrs(pref: ThemePref): string {
  const fixed = pref === ThemePref.System ? '' : ` data-theme="${pref}"`;
  return ` data-theme-pref="${pref}"${fixed}`;
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  root.setAttribute('data-theme-pref', pref);
  root.setAttribute('data-theme', resolvedTheme(pref, window.matchMedia('(prefers-color-scheme: dark)').matches));
}
