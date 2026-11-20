import type { ActionResult } from '@sveltejs/kit';
import { loadApi, postApi } from '$lib/dashboard/api';
import { canvasSettingsApi, DASHBOARD_SETTINGS_API, type SettingsSection } from './sections';

type Depends = (...deps: `${string}:${string}`[]) => void;

const PATH_PARAM = 'path';

export function loadSettingsShell<T>(projectId: string, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(canvasSettingsApi(projectId), new URLSearchParams({ [PATH_PARAM]: url.pathname }), depends);
}

export function loadSettingsPage<T>(projectId: string, section: SettingsSection, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(`${canvasSettingsApi(projectId)}/${section}`, url.searchParams, depends);
}

export function loadDashboardShell<T>(url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(DASHBOARD_SETTINGS_API, new URLSearchParams({ [PATH_PARAM]: url.pathname }), depends);
}

export function loadDashboardPage<T>(section: SettingsSection, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(`${DASHBOARD_SETTINGS_API}/${section}`, url.searchParams, depends);
}

export function postSettingsAction(api: string, section: SettingsSection, action: string, form: FormData): Promise<ActionResult> {
  return postApi(`${api}/${section}`, action, form);
}
