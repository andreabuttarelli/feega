import { siInstagram, siTiktok, siFacebook, siX, siThreads, siYoutube, siBluesky, siReddit } from 'simple-icons';

export const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', glyph: 'IG', bg: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)' },
  { key: 'tiktok', label: 'TikTok', glyph: 'TT', bg: '#111' },
  { key: 'facebook', label: 'Facebook', glyph: 'f', bg: '#1877f2' },
  { key: 'linkedin', label: 'LinkedIn', glyph: 'in', bg: '#0a66c2' },
  { key: 'x', label: 'X', glyph: 'X', bg: '#0a0a0a' },
  { key: 'threads', label: 'Threads', glyph: '@', bg: '#000000' },
  { key: 'youtube', label: 'YouTube', glyph: 'YT', bg: '#ff0000' },
  { key: 'bluesky', label: 'Bluesky', glyph: 'BS', bg: '#0285ff' },
  { key: 'reddit', label: 'Reddit', glyph: 'RD', bg: '#ff4500' }
] as const;

export const ICONS: Record<string, { path: string; hex: string }> = {
  instagram: siInstagram,
  tiktok: siTiktok,
  facebook: siFacebook,
  x: siX,
  threads: siThreads,
  youtube: siYoutube,
  bluesky: siBluesky,
  reddit: siReddit
};

/**
 * Scope decide DUE cose insieme: sotto quale gruppo la voce appare in nav, e se la sezione
 * richiede un brand collegato al progetto (`requiresBrand`). `project` è vuoto oggi — è lo scope
 * che riceverà le prime sezioni a livello di progetto quando lo split (Step B+) le sposta lì.
 */
export type SettingsScope = 'project' | 'workspace' | 'brand' | 'account';

export type SettingsSection = {
  /** Percorso sotto /p/<projectId>/settings/, incluse le sotto-rotte a più segmenti. */
  path: string;
  labelKey: string;
  scope: SettingsScope;
  requiresBrand: boolean;
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { path: 'project', labelKey: 'app.settings.project.title', scope: 'project', requiresBrand: false },
  { path: 'brand', labelKey: 'app.studio.tabs.brand', scope: 'brand', requiresBrand: false },
  {
    path: 'products',
    labelKey: 'app.hub.overview.brand.products',
    scope: 'brand',
    requiresBrand: true
  },
  {
    path: 'connected-accounts',
    labelKey: 'app.settings.connectedAccounts',
    scope: 'brand',
    requiresBrand: true
  },
  {
    path: 'facebook',
    labelKey: 'app.settings.connectedAccounts',
    scope: 'brand',
    requiresBrand: true
  },
  {
    path: 'linkedin',
    labelKey: 'app.settings.connectedAccounts',
    scope: 'brand',
    requiresBrand: true
  },
  {
    path: 'connect/[platform]',
    labelKey: 'app.settings.connectedAccounts',
    scope: 'brand',
    requiresBrand: true
  },
  { path: 'video', labelKey: 'app.settings.video.title', scope: 'brand', requiresBrand: true },
  { path: 'danger', labelKey: 'app.settings.del.title', scope: 'brand', requiresBrand: true },
  {
    path: 'api-keys',
    labelKey: 'app.settings.apiKeys.title',
    scope: 'workspace',
    requiresBrand: false
  },
  { path: 'team', labelKey: 'app.settings.team.title', scope: 'workspace', requiresBrand: false },
  {
    path: 'billing',
    labelKey: 'app.settings.billing.title',
    scope: 'workspace',
    requiresBrand: false
  },
  {
    path: 'profile',
    labelKey: 'app.settings.profile.title',
    scope: 'account',
    requiresBrand: false
  },
  {
    path: 'appearance',
    labelKey: 'app.settings.appearance.title',
    scope: 'account',
    requiresBrand: false
  }
] as const;

const SCOPE_LABEL_KEYS: Record<SettingsScope, string> = {
  project: 'app.nav.sectionProject',
  workspace: 'app.nav.workspace',
  brand: 'app.nav.sectionBrand',
  account: 'app.nav.sectionAccount'
};

const SCOPE_ORDER: readonly SettingsScope[] = ['project', 'workspace', 'brand', 'account'];

/** Sotto-rotte senza voce propria in nav: solo il capofila (es. `connected-accounts`) appare. */
const HIDDEN_FROM_NAV = new Set(['facebook', 'linkedin', 'connect/[platform]']);

export type SettingsNavEntry = { section: string; labelKey: string };

export const SETTINGS_GROUPS: readonly {
  labelKey: string;
  items: readonly SettingsNavEntry[];
}[] = SCOPE_ORDER.map((scope) => ({
  labelKey: SCOPE_LABEL_KEYS[scope],
  items: SETTINGS_SECTIONS.filter((s) => s.scope === scope && !HIDDEN_FROM_NAV.has(s.path)).map(
    (s) => ({ section: s.path, labelKey: s.labelKey })
  )
})).filter((group) => group.items.length > 0);

/** True quando `pathname` (es. `/p/x/settings/video`) è una sezione che richiede un brand. */
export function sectionRequiresBrand(pathname: string): boolean {
  const trimmed = pathname.replace(/\/$/, '');
  return SETTINGS_SECTIONS.some((s) => s.requiresBrand && trimmed.endsWith(`/settings/${s.path}`));
}
