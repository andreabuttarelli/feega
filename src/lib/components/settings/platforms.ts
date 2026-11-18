import { can, OrgAction, type OrgRole } from '$lib/org-roles';
import { DASHBOARD_SETTINGS_PATH, TEAM_PATH } from '$lib/settings/paths';
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
export const SETTINGS_HOME = 'project';

export type SettingsScope = 'project' | 'workspace' | 'brand' | 'account';

export type SettingsSection = {
  /** Percorso sotto /p/<projectId>/settings/, incluse le sotto-rotte a più segmenti. */
  path: string;
  labelKey: string;
  scope: SettingsScope;
  requiresBrand: boolean;
  alsoOnCanvas?: true;
  elsewhere?: string;
};

export enum SettingsHome {
  Canvas = 'canvas',
  Dashboard = 'dashboard'
}

export const SCOPE_HOME: Record<SettingsScope, SettingsHome> = {
  project: SettingsHome.Canvas,
  brand: SettingsHome.Canvas,
  workspace: SettingsHome.Dashboard,
  account: SettingsHome.Dashboard
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
  { path: 'video', labelKey: 'app.settings.video.title', scope: 'brand', requiresBrand: true },
  { path: 'danger', labelKey: 'app.settings.del.title', scope: 'brand', requiresBrand: true },
  {
    path: 'api-keys',
    labelKey: 'app.settings.apiKeys.title',
    scope: 'workspace',
    requiresBrand: false
  },
  { path: 'models', labelKey: 'app.settings.models.title', scope: 'workspace', requiresBrand: false },
  { path: 'fonts', labelKey: 'app.settings.fonts.title', scope: 'workspace', requiresBrand: false },
  { path: 'spend', labelKey: 'app.settings.spend.title', scope: 'workspace', requiresBrand: false, alsoOnCanvas: true },
  { path: 'team', labelKey: 'app.settings.team.title', scope: 'workspace', requiresBrand: false, elsewhere: TEAM_PATH },
  {
    path: 'content',
    labelKey: 'app.settings.content.title',
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

const GROUP_ORDER: Record<SettingsHome, readonly SettingsScope[]> = {
  [SettingsHome.Canvas]: ['project', 'brand'],
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
  if (!section || shownOn(section, SettingsHome.Canvas)) {
    return null;
  }
  return dashboardSettingsHref(section.path);
}

export function movedToDashboard(section: string): boolean {
  return SETTINGS_SECTIONS.some((s) => s.path === section && !shownOn(s, SettingsHome.Canvas));
}

/** True quando `pathname` (es. `/p/x/settings/video`) è una sezione che richiede un brand. */
const PERSONAL_SCOPE: SettingsScope = 'account';

export function sectionEditable(pathname: string, role: OrgRole): boolean {
  const trimmed = pathname.replace(/\/$/, '');
  const section = SETTINGS_SECTIONS.find((s) => trimmed.endsWith(`/settings/${s.path}`));
  return section?.scope === PERSONAL_SCOPE || can(role, OrgAction.Edit);
}

export function sectionRequiresBrand(pathname: string): boolean {
  const trimmed = pathname.replace(/\/$/, '');
  return SETTINGS_SECTIONS.some((s) => s.requiresBrand && trimmed.endsWith(`/settings/${s.path}`));
}
