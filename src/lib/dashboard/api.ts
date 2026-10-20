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

export async function chooseWorkspace(orgId: string): Promise<void> {
  rememberOrg(orgId);
  cache.clear();
  await call('/api/v1/orgs/active', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: orgId }) });
}

export type Sent = { ok: boolean; status: number; body: Record<string, unknown> };

export async function sendJson(path: string, method: string, payload: unknown = {}): Promise<Sent> {
  const { status, body } = await call(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  cache.clear();
  return { ok: status < 300, status, body: body as Record<string, unknown> };
}

export async function readJson<T>(path: string): Promise<T> {
  const { body } = await call(path);
  return body as T;
}

export async function createWorkspace(name: string): Promise<Sent> {
  const sent = await sendJson('/api/v1/orgs', 'POST', { name });
  if (sent.ok) {
    await chooseWorkspace(String(sent.body.org_id));
  }
  return sent;
}

function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: Answer }> {
  return apiCall<Answer>(path, init);
}

function keyOf(path: string): `api:${string}` {
  return `api:${path}`;
}

function reader(path: string): () => Promise<unknown> {
  return async () => {
    const { status, body } = await call(path);
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

export async function loadApi<T>(path: string, query: URLSearchParams, depends: Depends): Promise<T> {
  return (await cachedLoad(withOrg(path, query), depends)) as T;
}

export async function postApi(path: string, action: string, form: FormData): Promise<ActionResult> {
  const query = new URLSearchParams({ action });
  const { status, body } = await call(withOrg(path, query), { method: 'POST', body: form });
  cache.clear();
  return actionResultOf(status, body);
}

export function postAction(page: DashboardPage, action: string, form: FormData): Promise<ActionResult> {
  return postApi(`/api/v1/me/pages/${page}`, action, form);
}
