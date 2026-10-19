export enum SettingsSection {
  Project = 'project',
  Brand = 'brand',
  Video = 'video',
  Profile = 'profile',
  Content = 'content',
  Team = 'team',
  ApiKeys = 'api-keys',
  Danger = 'danger',
  Products = 'products'
}

const SECTIONS = new Set<string>(Object.values(SettingsSection));
const SETTINGS_PATH = /^\/p\/([^/]+)\/settings\/([^/]+)\/?$/;

export function isSettingsSection(name: string): name is SettingsSection {
  return SECTIONS.has(name);
}

export function settingsPath(projectId: string, section: SettingsSection): string {
  return `/p/${projectId}/settings/${section}`;
}

export function sectionAt(pathname: string): { projectId: string; section: SettingsSection } | null {
  const match = SETTINGS_PATH.exec(pathname);
  if (!match || !isSettingsSection(match[2])) {
    return null;
  }
  return { projectId: match[1], section: match[2] };
}

export type SettingsTarget = { projectId: string; section: SettingsSection; action: string };

export function settingsTarget(actionAttribute: string, currentPath: string): SettingsTarget | null {
  const url = new URL(actionAttribute, `https://settings${currentPath}`);
  const action = [...url.searchParams.keys()].find((key) => key.startsWith('/'));
  const at = sectionAt(url.pathname);
  if (!action || !at) {
    return null;
  }
  return { ...at, action: action.slice(1) };
}
