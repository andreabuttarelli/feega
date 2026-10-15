import { invalidate } from '$app/navigation';
import { env as publicEnv } from '$env/dynamic/public';
import type { ActionResult } from '@sveltejs/kit';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import { SwrCache } from './swr';
import { actionResultOf, loadedOf, type Answer } from './answers';
import type { DashboardPage } from './pages';
import type { AppShell } from '$lib/server/dashboard/app-shell';
import type { FirstRunFlags } from '$lib/server/dashboard/first-run-flags';
import type { Dashboard } from '$lib/server/dashboard/dashboard';

const ORG_COOKIE = 'dz-org';
const ORG_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const UNAUTHORIZED = 401;

export type Bootstrap = { user: { id: string; email: string | null }; shell: AppShell; flags: FirstRunFlags; dashboard: Dashboard };

type Depends = (...deps: `${string}:${string}`[]) => void;

const cache = new SwrCache();
let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function apiUrl(path: string): string {
  return `${publicEnv.PUBLIC_API_BASE ?? ''}${path}`;
}

async function token(): Promise<string | null> {
  supabase ??= createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function orgHint(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ORG_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function chooseWorkspace(orgId: string): void {
  document.cookie = `${ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=${ORG_COOKIE_MAX_AGE_S}; samesite=lax`;
  cache.clear();
}

function withOrg(path: string, query: URLSearchParams = new URLSearchParams()): string {
  const params = new URLSearchParams(query);
  const org = orgHint();
  if (org) {
    params.set('org', org);
  }
  const search = params.toString();
  return search ? `${path}${path.includes('?') ? '&' : '?'}${search}` : path;
}

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: Answer }> {
  const bearer = await token();
  if (!bearer) {
    return { status: UNAUTHORIZED, body: { error: 'missing_bearer' } };
  }
  const res = await fetch(apiUrl(path), { ...init, headers: { ...init.headers, authorization: `Bearer ${bearer}` } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Answer };
}

async function cachedLoad(path: string, depends: Depends): Promise<unknown> {
  const key = `api:${path}` as const;
  depends(key);
  const read = async () => {
    const { status, body } = await call(path);
    return loadedOf(status, body);
  };
  return cache.read(key, read, () => void invalidate(key));
}

export async function loadBootstrap(depends: Depends): Promise<Bootstrap> {
  return (await cachedLoad(withOrg('/api/v1/me/bootstrap'), depends)) as Bootstrap;
}

export async function loadPage<T>(page: DashboardPage, url: URL, depends: Depends): Promise<T> {
  return (await cachedLoad(withOrg(`/api/v1/me/pages/${page}`, url.searchParams), depends)) as T;
}

export async function postAction(page: DashboardPage, action: string, form: FormData): Promise<ActionResult> {
  const query = new URLSearchParams({ action });
  const { status, body } = await call(withOrg(`/api/v1/me/pages/${page}`, query), { method: 'POST', body: form });
  cache.clear();
  return actionResultOf(status, body);
}
