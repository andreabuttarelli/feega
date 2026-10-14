export const PERF_STORAGE_KEY = 'feega:perf-hud';

const PERF_PARAM = 'perf';
const ON = '1';
const OFF = '0';

export function perfHudAsked(search: string): string | null {
  const asked = new URLSearchParams(search).get(PERF_PARAM);
  return asked === ON || asked === OFF ? asked : null;
}

export function perfHudWanted(search: string, stored: string | null): boolean {
  return (perfHudAsked(search) ?? stored) === ON;
}

export function perfHudFromLocation(): boolean {
  try {
    const asked = perfHudAsked(location.search);
    if (asked) {
      localStorage.setItem(PERF_STORAGE_KEY, asked);
    }
    return perfHudWanted(location.search, localStorage.getItem(PERF_STORAGE_KEY));
  } catch {
    return perfHudWanted(location.search, null);
  }
}
