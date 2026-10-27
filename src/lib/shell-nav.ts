import type { Viewport } from '$lib/breakpoints';
import { env as publicEnv } from '$env/dynamic/public';
import { isLocalMode } from '$lib/local-user';

export type NavFamily = 'panel' | 'sheet' | 'route';

export type NavEntry = {
  id: string;
  labelKey: string;
  icon: 'images' | 'palette' | 'users-round' | 'settings' | 'camera' | 'layers';
  family: NavFamily;
  path: string;
  mobilePath?: string;
  group: 'canvas' | 'panel' | 'workbench' | 'menu';
  local?: true;
  shortcut?: string;
};

/**
 * OGNI VOCE DELLA RAIL, IN UNA TABELLA SOLA. `family` decide come si apre — `panel` accanto alla
 * tela (Assets/Brands, un pannello alla volta), `sheet` al posto della tela (Calendar/Ads/
 * Settings, un foglio SvelteKit shallow-routed sopra). La rail li separa in due gruppi con un
 * divisore: il raggruppamento stesso dice il comportamento, senza un `if` per voce altrove.
 */
export const NAV_ENTRIES: NavEntry[] = [
  { id: 'assets', labelKey: 'app.nav2.materials', icon: 'images', family: 'panel', path: '/assets', group: 'panel', local: true, shortcut: 'Alt+2' },
  { id: 'brands', labelKey: 'app.nav2.brands', icon: 'palette', family: 'panel', path: '/brands', group: 'panel', shortcut: 'Alt+3' },
  { id: 'influencers', labelKey: 'app.nav2.influencers', icon: 'users-round', family: 'panel', path: '/influencers', group: 'panel', shortcut: 'Alt+4' },
  { id: 'studio', labelKey: 'app.nav2.studio', icon: 'camera', family: 'route', path: '/app/studio', group: 'menu' },
  { id: 'settings', labelKey: 'app.nav.settings', icon: 'settings', family: 'sheet', path: '/settings/project', mobilePath: '/settings', group: 'workbench' },
  { id: 'layers', labelKey: 'app.nav2.layers', icon: 'layers', family: 'panel', path: '', group: 'canvas', local: true, shortcut: 'Alt+1' }
];

export const PANEL_WIDTHS: Record<string, number> = {
  layers: 280,
  assets: 320,
  brands: 320,
  influencers: 320
};

export function navEntriesByGroup(group: NavEntry['group']): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.group === group && (entry.local || !isLocalMode(publicEnv)));
}

const projectPath = (projectId: string, path: string) => `/p/${projectId}${path}`;

const HREF_OF_FAMILY: Record<NavFamily, (projectId: string, path: string) => string> = {
  panel: projectPath,
  sheet: projectPath,
  route: (projectId, path) => `${path}?project=${projectId}`
};

export function navHref(projectId: string, entry: NavEntry): string {
  return HREF_OF_FAMILY[entry.family](projectId, entry.path);
}

export function mobileNavHref(projectId: string, entry: NavEntry): string {
  return HREF_OF_FAMILY[entry.family](projectId, entry.mobilePath ?? entry.path);
}

/**
 * LA RADICE DI UNA VOCE `sheet` è il suo primo segmento (`/settings`): il
 * foglio Settings deve restare aperto anche su `/settings/brand`, non solo sull'esatto
 * `/settings/project` a cui la rail porta di default — la sezione dentro cambia, la
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

export const BURGER_ENTRIES: NavEntry[] = [...navEntriesByGroup('panel'), ...navEntriesByGroup('workbench'), ...navEntriesByGroup('menu')];

export function panelForShortcut(e: KeyboardEvent): NavEntry | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) {
    return null;
  }

  const digit = e.code.replace('Digit', '');
  const shortcut = `Alt+${digit}`;
  return [...navEntriesByGroup('canvas'), ...navEntriesByGroup('panel')].find((entry) => entry.shortcut === shortcut) ?? null;
}

export type DirectLoadMode = 'sheet' | 'page';


const VIEWPORT_ALLOWS_SHEET: Record<Viewport, boolean> = {
  mobile: false,
  desktop: true
};

export function directLoadMode(path: string, viewport: Viewport): DirectLoadMode {
  const pageOnly =
    !VIEWPORT_ALLOWS_SHEET[viewport] ||
    !sheetEntryForPath(path);
  return pageOnly ? 'page' : 'sheet';
}
