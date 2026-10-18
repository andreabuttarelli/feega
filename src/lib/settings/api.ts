import type { ActionResult } from '@sveltejs/kit';
import { loadApi, postApi } from '$lib/dashboard/api';
import type { SettingsSection } from './sections';

type Depends = (...deps: `${string}:${string}`[]) => void;

const PATH_PARAM = 'path';

function settingsApi(projectId: string): string {
  return `/api/v1/me/projects/${encodeURIComponent(projectId)}/settings`;
}

export function loadSettingsShell<T>(projectId: string, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(settingsApi(projectId), new URLSearchParams({ [PATH_PARAM]: url.pathname }), depends);
}

export function loadSettingsPage<T>(projectId: string, section: SettingsSection, url: URL, depends: Depends): Promise<T> {
  return loadApi<T>(`${settingsApi(projectId)}/${section}`, url.searchParams, depends);
}

export function postSettingsAction(projectId: string, section: SettingsSection, action: string, form: FormData): Promise<ActionResult> {
  return postApi(`${settingsApi(projectId)}/${section}`, action, form);
}
