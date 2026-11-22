export enum SettingsSection {
  Profile = 'profile',
  Billing = 'billing'
}

export const DASHBOARD_SETTINGS_API = '/api/v1/me/settings';

export function canvasSettingsApi(projectId: string): string {
  return `/api/v1/me/projects/${encodeURIComponent(projectId)}/settings`;
}

type Surface = { pattern: RegExp; api: (id: string) => string };

const SURFACES: readonly Surface[] = [
  { pattern: /^\/p\/(?<id>[^/]+)\/settings\/(?<section>[^/]+)\/?$/, api: canvasSettingsApi },
  { pattern: /^\/app\/settings\/(?<section>[^/]+)\/?$/, api: () => DASHBOARD_SETTINGS_API }
];

const SECTIONS = new Set<string>(Object.values(SettingsSection));

export function isSettingsSection(name: string): name is SettingsSection {
  return SECTIONS.has(name);
}

export function settingsPath(projectId: string, section: SettingsSection): string {
  return `/p/${projectId}/settings/${section}`;
}

export function sectionAt(pathname: string): { api: string; section: SettingsSection } | null {
  for (const { pattern, api } of SURFACES) {
    const groups = pattern.exec(pathname)?.groups;
    if (groups && isSettingsSection(groups.section)) {
      return { api: api(groups.id ?? ''), section: groups.section };
    }
  }
  return null;
}

export type SettingsTarget = { api: string; section: SettingsSection; action: string };

export function settingsTarget(actionAttribute: string, currentPath: string): SettingsTarget | null {
  const url = new URL(actionAttribute, `https://settings${currentPath}`);
  const action = [...url.searchParams.keys()].find((key) => key.startsWith('/'));
  const at = sectionAt(url.pathname);
  if (!action || !at) {
    return null;
  }
  return { ...at, action: action.slice(1) };
}
