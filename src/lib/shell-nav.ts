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
  { id: 'ads', labelKey: 'app.hub.ads.social', icon: 'megaphone', family: 'sheet', path: '/ads/social', group: 'workbench' },
  { id: 'settings', labelKey: 'app.nav.settings', icon: 'settings', family: 'sheet', path: '/settings/connected-accounts', mobilePath: '/settings', group: 'workbench' },
  { id: 'create-post', labelKey: 'app.hub.publish.createPost', icon: 'megaphone', family: 'sheet', path: '/create-post', group: 'hidden' }
];

/**
 * LARGHEZZA DI OGNI FOGLIO/PANNELLO, IN UNA TABELLA SOLA — non CSS per componente. Calendar è
 * una griglia mensile e vuole più spazio; gli altri fogli (Ads, Settings, Create post) sono
 * moduli di testo e stanno bene più stretti. I pannelli sinistri (Assets/Brands/Influencers)
 * restano alla larghezza fissa che avevano.
 */
export const SHEET_WIDTHS: Record<string, number> = {
  calendar: 960,
  ads: 720,
  settings: 720,
  'create-post': 720,
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

export type MobileTab = {
  id: 'canvas' | 'chat' | 'calendar' | 'more';
  labelKey: string;
  icon: 'layout-grid' | 'message-circle' | 'calendar-days' | 'more-horizontal';
  path: string | null;
  root: string | null;
};

export type MobileView = 'page' | 'chat';

export type TabOutcome = 'handled' | 'follow-link';

export const MOBILE_TABS: MobileTab[] = [
  { id: 'canvas', labelKey: 'app.shell.mobile.canvas', icon: 'layout-grid', path: '', root: '/c' },
  { id: 'chat', labelKey: 'app.shell.mobile.chat', icon: 'message-circle', path: null, root: null },
  { id: 'calendar', labelKey: 'app.hub.publish.calendar', icon: 'calendar-days', path: '/calendar', root: '/calendar' },
  { id: 'more', labelKey: 'app.shell.mobile.more', icon: 'more-horizontal', path: null, root: null }
];

export function mobileTabHref(projectId: string, tab: MobileTab): string | null {
  return tab.path === null ? null : `/p/${projectId}${tab.path}`;
}

export function activeMobileTab(projectId: string, pathname: string, view: MobileView): MobileTab['id'] {
  if (view === 'chat') {
    return 'chat';
  }
  const inner = pathname.slice(`/p/${projectId}`.length);
  const hit = MOBILE_TABS.find((tab) => tab.root !== null && (inner === tab.root || inner.startsWith(`${tab.root}/`)));
  return hit?.id ?? 'more';
}

export const MOBILE_MORE_ENTRIES: NavEntry[] = NAV_ENTRIES.filter(
  (entry) => entry.group !== 'hidden' && entry.id !== 'calendar'
);
