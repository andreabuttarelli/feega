import { env as publicEnv } from '$env/dynamic/public';
import { createSupabaseBrowserClient } from '$lib/supabase/client';

const ORG_COOKIE = 'dz-org';
const ORG_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const UNAUTHORIZED = 401;

export type ApiAnswer<T = Record<string, unknown>> = { status: number; body: T };

let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;

function apiUrl(path: string): string {
  return `${publicEnv.PUBLIC_API_BASE ?? ''}${path}`;
}

export function browserSupabase(): ReturnType<typeof createSupabaseBrowserClient> {
  supabase ??= createSupabaseBrowserClient();
  return supabase;
}

export async function viewerSession() {
  const { data } = await browserSupabase().auth.getSession();
  return data.session;
}

async function token(): Promise<string | null> {
  return (await viewerSession())?.access_token ?? null;
}

export function orgHint(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ORG_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function rememberOrg(orgId: string): void {
  document.cookie = `${ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=${ORG_COOKIE_MAX_AGE_S}; samesite=lax`;
}

export function withOrg(path: string, query: URLSearchParams = new URLSearchParams()): string {
  const params = new URLSearchParams(query);
  const org = orgHint();
  if (org) {
    params.set('org', org);
  }
  const search = params.toString();
  return search ? `${path}${path.includes('?') ? '&' : '?'}${search}` : path;
}

export async function apiCall<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<ApiAnswer<T>> {
  const bearer = await token();
  if (!bearer) {
    return { status: UNAUTHORIZED, body: { error: 'missing_bearer' } as T };
  }
  const res = await fetch(apiUrl(path), { ...init, headers: { ...init.headers, authorization: `Bearer ${bearer}` } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

export async function viewerCall<T>(path: string): Promise<T> {
  const bearer = await token();
  const headers: Record<string, string> = bearer ? { authorization: `Bearer ${bearer}` } : {};
  const res = await fetch(apiUrl(path), { headers });
  return (await res.json()) as T;
}
