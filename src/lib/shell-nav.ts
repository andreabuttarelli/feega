import type { Viewport } from '$lib/breakpoints';

export type NavFamily = 'panel' | 'sheet';

export type NavEntry = {
  id: string;
  labelKey: string;
  icon: 'images' | 'building' | 'user-round' | 'calendar-days' | 'megaphone' | 'settings';
  family: NavFamily;
  path: string;
  mobilePath?: string;
  group: 'panel' | 'workbench' | 'hidden';
};

/**
 * OGNI VOCE DELLA RAIL, IN UNA TABELLA SOLA. `family` decide come si apre — `panel` accanto alla
 * tela (Assets/Brands, un pannello alla volta), `sheet` al posto della tela (Calendar/Ads/
 * Settings, un foglio SvelteKit shallow-routed sopra). La rail li separa in due gruppi con un
 * divisore: il raggruppamento stesso dice il comportamento, senza un `if` per voce altrove.
 */
export const NAV_ENTRIES: NavEntry[] = [
  { id: 'assets', labelKey: 'app.nav2.materials', icon: 'images', family: 'panel', path: '/assets', group: 'panel' },
  { id: 'brands', labelKey: 'app.nav2.brands', icon: 'building', family: 'panel', path: '/brands', group: 'panel' },
  { id: 'influencers', labelKey: 'app.nav2.influencers', icon: 'user-round', family: 'panel', path: '/influencers', group: 'panel' },
  { id: 'calendar', labelKey: 'app.hub.publish.calendar', icon: 'calendar-days', family: 'sheet', path: '/calendar', group: 'workbench' },
  { id: 'ads', labelKey: 'app.hub.ads.social', icon: 'megaphone', family: 'sheet', path: '/ads', group: 'workbench' },
  { id: 'studio', labelKey: 'app.nav2.studio', icon: 'images', family: 'sheet', path: '/studio', group: 'workbench' },
  { id: 'settings', labelKey: 'app.nav.settings', icon: 'settings', family: 'sheet', path: '/settings/connected-accounts', mobilePath: '/settings', group: 'workbench' },
  { id: 'promote', labelKey: 'app.hub.publish.promote', icon: 'megaphone', family: 'sheet', path: '/promote', group: 'hidden' }
];

export const PANEL_WIDTHS: Record<string, number> = {
  assets: 320,
  brands: 320,
  influencers: 320
};

export function navEntriesByGroup(group: NavEntry['group']): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.group === group);
}

export function navHref(projectId: string, entry: NavEntry): string {
  return `/p/${projectId}${entry.path}`;
}

export function mobileNavHref(projectId: string, entry: NavEntry): string {
  return `/p/${projectId}${entry.mobilePath ?? entry.path}`;
}

/**
 * LA RADICE DI UNA VOCE `sheet` è il suo primo segmento (`/settings`, `/calendar`, `/ads`): il
 * foglio Settings deve restare aperto anche su `/settings/brand`, non solo sull'esatto
 * `/settings/connected-accounts` a cui la rail porta di default — la sezione dentro cambia, la
 * famiglia no. Una sola regola invece di un elenco di prefissi sparso fra layout e componenti.
 */
function sheetRootOf(entry: NavEntry): string {
  return `/${entry.path.split('/')[1]}`;
}

export function sheetEntryForPath(path: string): NavEntry | null {
  const normalized = path.split(/[?#]/)[0].replace(/\/$/, '');
  return (
    NAV_ENTRIES.find((entry) => {
      if (entry.family !== 'sheet') return false;
      const root = sheetRootOf(entry);
      return normalized === root || normalized.startsWith(`${root}/`);
    }) ?? null
  );
}

export const BURGER_ENTRIES: NavEntry[] = [...navEntriesByGroup('panel'), ...navEntriesByGroup('workbench')];

export type DirectLoadMode = 'sheet' | 'page';

const PAGE_ONLY_PREFIXES = ['/settings/facebook', '/settings/linkedin', '/settings/connect/'];
const PAGE_ONLY_QUERY_KEYS = ['connected'];

const VIEWPORT_ALLOWS_SHEET: Record<Viewport, boolean> = {
  mobile: false,
  desktop: true
};

export function directLoadMode(path: string, search: string, viewport: Viewport): DirectLoadMode {
  const params = new URLSearchParams(search);
  const pageOnly =
    !VIEWPORT_ALLOWS_SHEET[viewport] ||
    !sheetEntryForPath(path) ||
    PAGE_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    PAGE_ONLY_QUERY_KEYS.some((key) => params.has(key));
  return pageOnly ? 'page' : 'sheet';
}
