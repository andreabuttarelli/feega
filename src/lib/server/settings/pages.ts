import { SettingsSection } from '$lib/settings/sections';

type Handler = (event: never) => unknown;
export type SettingsPage = { load?: Handler; actions?: Record<string, Handler> };

export const SETTINGS_PAGES: Record<SettingsSection, () => Promise<SettingsPage>> = {
  [SettingsSection.Profile]: () => import('./pages/profile'),
  [SettingsSection.Billing]: () => import('./pages/billing')
};
