import { invalidate } from '$app/navigation';
import type { ActionResult } from '@sveltejs/kit';
import { apiCall, rememberOrg, withOrg } from '$lib/api/client';
import { SwrCache } from './swr';
import { actionResultOf, loadedOf, type Answer } from './answers';
import { pageAt, type DashboardPage } from './pages';
import type { AppShell } from '$lib/server/dashboard/app-shell';
import type { FirstRunFlags } from '$lib/server/dashboard/first-run-flags';
import type { Dashboard } from '$lib/server/dashboard/dashboard';

export type Bootstrap = { user: { id: string; email: string | null }; shell: AppShell; flags: FirstRunFlags; dashboard: Dashboard };

type Depends = (...deps: `${string}:${string}`[]) => void;

const cache = new SwrCache();

export function chooseWorkspace(orgId: string): void {
  rememberOrg(orgId);
  cache.clear();
}

function keyOf(path: string): `api:${string}` {
  return `api:${path}`;
}

function reader(path: string): () => Promise<unknown> {
  return async () => {
    const { status, body } = await apiCall<Answer>(path);
    return loadedOf(status, body);
  };
}

async function cachedLoad(path: string, depends: Depends): Promise<unknown> {
  const key = keyOf(path);
  depends(key);
  return cache.read(key, reader(path), () => void invalidate(key));
}

function bootstrapPath(): string {
  return withOrg('/api/v1/me/bootstrap');
}

function pagePath(page: DashboardPage, url: URL): string {
  return withOrg(`/api/v1/me/pages/${page}`, url.searchParams);
}

export async function loadBootstrap(depends: Depends): Promise<Bootstrap> {
  return (await cachedLoad(bootstrapPath(), depends)) as Bootstrap;
}

export async function loadPage<T>(page: DashboardPage, url: URL, depends: Depends): Promise<T> {
  return (await cachedLoad(pagePath(page, url), depends)) as T;
}

export function warmDashboard(url: URL): void {
  const page = pageAt(url.pathname);
  if (!page) {
    return;
  }
  for (const path of [bootstrapPath(), pagePath(page, url)]) {
    cache.warm(keyOf(path), reader(path));
  }
}

export async function postAction(page: DashboardPage, action: string, form: FormData): Promise<ActionResult> {
  const query = new URLSearchParams({ action });
  const { status, body } = await apiCall<Answer>(withOrg(`/api/v1/me/pages/${page}`, query), { method: 'POST', body: form });
  cache.clear();
  return actionResultOf(status, body);
}
