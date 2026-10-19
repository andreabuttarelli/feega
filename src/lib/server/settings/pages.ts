import { SettingsSection } from '$lib/settings/sections';

type Handler = (event: never) => unknown;
export type SettingsPage = { load?: Handler; actions?: Record<string, Handler> };

export const SETTINGS_PAGES: Record<SettingsSection, () => Promise<SettingsPage>> = {
  [SettingsSection.Project]: () => import('./pages/project'),
  [SettingsSection.Brand]: () => import('./pages/brand'),
  [SettingsSection.Video]: () => import('./pages/video'),
  [SettingsSection.Profile]: () => import('./pages/profile'),
  [SettingsSection.Content]: () => import('./pages/content'),
  [SettingsSection.Team]: () => import('./pages/team'),
  [SettingsSection.ApiKeys]: () => import('./pages/api-keys'),
  [SettingsSection.Danger]: () => import('./pages/danger'),
  [SettingsSection.Products]: () => import('./pages/products')
};
