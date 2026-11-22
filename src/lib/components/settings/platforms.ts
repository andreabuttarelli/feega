import { can, OrgAction, type OrgRole } from '$lib/org-roles';
import { DASHBOARD_SETTINGS_PATH } from '$lib/settings/paths';
import { SettingsSection } from '$lib/settings/sections';

export enum SettingsScope {
  Account = 'account',
  Workspace = 'workspace'
}

export type SettingsSectionRow = {
  path: SettingsSection;
  labelKey: string;
  subtitleKey?: string;
  scope: SettingsScope;
  gatesItself?: true;
};

export const SETTINGS_SECTIONS: readonly SettingsSectionRow[] = [
  { path: SettingsSection.Profile, labelKey: 'app.settings.profile.title', scope: SettingsScope.Account },
  { path: SettingsSection.Billing, labelKey: 'app.settings.billing.title', subtitleKey: 'app.settings.billing.subtitle', scope: SettingsScope.Workspace, gatesItself: true }
];

export type SettingsNavEntry = { section: SettingsSection; labelKey: string; href: string };

export function dashboardSettingsHref(section: SettingsSection): string {
  return `${DASHBOARD_SETTINGS_PATH}/${section}`;
}

export const SETTINGS_NAV: readonly SettingsNavEntry[] = SETTINGS_SECTIONS.map((s) => ({
  section: s.path,
  labelKey: s.labelKey,
  href: dashboardSettingsHref(s.path)
}));

export function servedOnDashboard(section: SettingsSection): boolean {
  return SETTINGS_SECTIONS.some((s) => s.path === section);
}

export function sectionEditable(pathname: string, role: OrgRole): boolean {
  const trimmed = pathname.replace(/\/$/, '');
  const section = SETTINGS_SECTIONS.find((s) => trimmed.endsWith(`/settings/${s.path}`));
  return section?.scope === SettingsScope.Account || section?.gatesItself === true || can(role, OrgAction.Edit);
}
