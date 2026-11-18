import type { ActionResult } from '@sveltejs/kit';
import { loadApi, postApi } from '$lib/dashboard/api';
import { brandSettingsApi, BRANDS_SETTINGS_API, canvasSettingsApi, DASHBOARD_SETTINGS_API, type SettingsSection } from './sections';

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

export function loadBrandsList<T>(url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(BRANDS_SETTINGS_API, url.searchParams, depends);
}

export function loadBrandShell<T>(brandId: string, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(brandSettingsApi(brandId), new URLSearchParams({ [PATH_PARAM]: url.pathname }), depends);
}

export function loadBrandPage<T>(brandId: string, section: SettingsSection, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(`${brandSettingsApi(brandId)}/${section}`, url.searchParams, depends);
}

export function postSettingsAction(api: string, section: SettingsSection, action: string, form: FormData): Promise<ActionResult> {
  return postApi(`${api}/${section}`, action, form);
}
