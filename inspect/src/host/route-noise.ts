import { matchRoute } from '../route-match';

type PlaceholderRow = { matches: (param: string, value: string) => boolean };

const PLACEHOLDER_ROWS: PlaceholderRow[] = [{ matches: (param, value) => value === param }, { matches: (_param, value) => value.length === 1 }];

export const NOISY_FILE = /\.(test|spec|stories)\.[^/]+$|(^|\/)(__tests__|__fixtures__|fixtures?|tests?|e2e)\//;

export const isPlaceholder = (route: string, path: string): boolean =>
  Object.entries(matchRoute(route, path) ?? {}).some(([param, value]) => PLACEHOLDER_ROWS.some((row) => row.matches(param, value)));
