import { can, OrgAction, type OrgRole } from '$lib/org-roles';
import { BRANDS_SETTINGS_PATH, DASHBOARD_SETTINGS_PATH, TEAM_PATH } from '$lib/settings/paths';
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

export const SETTINGS_HOME = 'project';

export type SettingsScope = 'project' | 'workspace' | 'brand' | 'account';

const BRAND_SCOPE: SettingsScope = 'brand';

export type SettingsSection = {
  /** Percorso sotto /p/<projectId>/settings/, incluse le sotto-rotte a più segmenti. */
  path: string;
  labelKey: string;
  scope: SettingsScope;
  alsoOnCanvas?: true;
  elsewhere?: string;
};

export enum SettingsHome {
  Canvas = 'canvas',
  Dashboard = 'dashboard'
}

export const SCOPE_HOME: Record<SettingsScope, SettingsHome> = {
  project: SettingsHome.Canvas,
  brand: SettingsHome.Dashboard,
  workspace: SettingsHome.Dashboard,
  account: SettingsHome.Dashboard
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { path: 'project', labelKey: 'app.settings.project.title', scope: 'project' },
  { path: 'history', labelKey: 'app.nav2.history', scope: 'project' },
  { path: 'brand', labelKey: 'app.studio.tabs.brand', scope: 'brand' },
  {
    path: 'products',
    labelKey: 'app.hub.overview.brand.products',
    scope: 'brand'
  },
  { path: 'video', labelKey: 'app.settings.video.title', scope: 'brand' },
  { path: 'danger', labelKey: 'app.settings.del.title', scope: 'brand' },
  {
    path: 'api-keys',
    labelKey: 'app.settings.apiKeys.title',
    scope: 'workspace'
  },
  { path: 'models', labelKey: 'app.settings.models.title', scope: 'workspace' },
  { path: 'fonts', labelKey: 'app.settings.fonts.title', scope: 'workspace' },
  { path: 'spend', labelKey: 'app.settings.spend.title', scope: 'workspace', alsoOnCanvas: true },
  { path: 'team', labelKey: 'app.settings.team.title', scope: 'workspace', elsewhere: TEAM_PATH },
  {
    path: 'content',
    labelKey: 'app.settings.content.title',
    scope: 'workspace'
  },
  {
    path: 'profile',
    labelKey: 'app.settings.profile.title',
    scope: 'account'
  },
  {
    path: 'appearance',
    labelKey: 'app.settings.appearance.title',
    scope: 'account'
  }
] as const;

const SCOPE_LABEL_KEYS: Record<SettingsScope, string> = {
  project: 'app.nav.sectionProject',
  workspace: 'app.nav.workspace',
  brand: 'app.nav.sectionBrand',
  account: 'app.nav.sectionAccount'
};

const GROUP_ORDER: Record<SettingsHome, readonly SettingsScope[]> = {
  [SettingsHome.Canvas]: ['project'],
  [SettingsHome.Dashboard]: ['account', 'workspace']
};

export type SettingsNavEntry = { section: string; labelKey: string };

function shownOn(section: SettingsSection, home: SettingsHome): boolean {
  return SCOPE_HOME[section.scope] === home || (home === SettingsHome.Canvas && section.alsoOnCanvas === true);
}

function groupScopeOf(section: SettingsSection, home: SettingsHome): SettingsScope {
  return home === SettingsHome.Canvas && section.alsoOnCanvas ? 'project' : section.scope;
}

function groupsOn(home: SettingsHome): readonly { labelKey: string; items: readonly SettingsNavEntry[] }[] {
  return GROUP_ORDER[home]
    .map((scope) => ({
      labelKey: SCOPE_LABEL_KEYS[scope],
      items: SETTINGS_SECTIONS.filter((s) => shownOn(s, home) && groupScopeOf(s, home) === scope).map((s) => ({ section: s.path, labelKey: s.labelKey }))
    }))
    .filter((group) => group.items.length > 0);
}

export const CANVAS_SETTINGS_GROUPS = groupsOn(SettingsHome.Canvas);

export const DASHBOARD_SETTINGS_GROUPS = groupsOn(SettingsHome.Dashboard);

export function dashboardSettingsHref(section: string): string {
  return SETTINGS_SECTIONS.find((s) => s.path === section)?.elsewhere ?? `${DASHBOARD_SETTINGS_PATH}/${section}`;
}

export function canvasRedirectOf(pathname: string): string | null {
  const section = SETTINGS_SECTIONS.find((s) => pathname.replace(/\/$/, '').endsWith(`/settings/${s.path}`));
  if (!section || section.scope === BRAND_SCOPE || shownOn(section, SettingsHome.Canvas)) {
    return null;
  }
  return dashboardSettingsHref(section.path);
}

export const BRAND_SETTINGS_ITEMS: readonly SettingsNavEntry[] = SETTINGS_SECTIONS.filter((s) => s.scope === BRAND_SCOPE).map((s) => ({ section: s.path, labelKey: s.labelKey }));

export function servedOnDashboard(section: string): boolean {
  return SETTINGS_SECTIONS.some((s) => s.path === section && s.scope !== BRAND_SCOPE && SCOPE_HOME[s.scope] === SettingsHome.Dashboard);
}

export function servedForBrand(section: string): boolean {
  return SETTINGS_SECTIONS.some((s) => s.path === section && s.scope === BRAND_SCOPE);
}

export function brandSettingsHref(brandId: string, section: string): string {
  return `${BRANDS_SETTINGS_PATH}/${brandId}/${section}`;
}

const BRAND_PAGE = /\/settings\/brands\/(?<brandId>[^/]+)\/(?<section>[^/]+)$/;

export function brandPageAt(pathname: string): { brandId: string; section: string } | null {
  const groups = BRAND_PAGE.exec(pathname.replace(/\/$/, ''))?.groups;
  return groups ? { brandId: groups.brandId, section: groups.section } : null;
}

export function brandRedirectOf(pathname: string, brandId: string | null): string | null {
  const trimmed = pathname.replace(/\/$/, '');
  const section = SETTINGS_SECTIONS.find((s) => s.scope === BRAND_SCOPE && trimmed.endsWith(`/settings/${s.path}`));
  if (!section) {
    return null;
  }
  return brandId ? brandSettingsHref(brandId, section.path) : BRANDS_SETTINGS_PATH;
}

export function movedToDashboard(section: string): boolean {
  return SETTINGS_SECTIONS.some((s) => s.path === section && !shownOn(s, SettingsHome.Canvas));
}

const PERSONAL_SCOPE: SettingsScope = 'account';

export function sectionEditable(pathname: string, role: OrgRole): boolean {
  const trimmed = pathname.replace(/\/$/, '');
  const section = SETTINGS_SECTIONS.find((s) => trimmed.endsWith(`/settings/${s.path}`));
  return section?.scope === PERSONAL_SCOPE || can(role, OrgAction.Edit);
}
