import { ThemePref, applyTheme } from '$lib/theme';

const LEGACY_KEY = 'theme';

export function chooseTheme(next: ThemePref): void {
  applyTheme(next);
  try {
    if (next === ThemePref.System) {
      localStorage.removeItem(LEGACY_KEY);
    } else {
      localStorage.setItem(LEGACY_KEY, next);
    }
  } catch {
    void 0;
  }
  void fetch('/api/theme', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: next }) });
}
