import { json, redirect, type RequestEvent, type ResolveOptions } from '@sveltejs/kit';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createUserDb } from '$lib/server/db/client';

export const LOCAL_MODE_TOKEN = 'local-mode';
export const LOCAL_PROJECT_SLUG = 'local';

type Env = Record<string, string | undefined>;
type Resolve = (event: RequestEvent, opts?: ResolveOptions) => Response | Promise<Response>;
export type LocalPlace = { projectId: string; canvasId: string };

const DEFAULT_DEMO_EMAIL = 'demo@feega.local';
const DEFAULT_DEMO_PASSWORD = 'feega-demo-2026';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const API_PREFIX = '/api/';
const ROOT = '/';
const REDIRECTED_PREFIXES = ['/app', '/login', '/account', '/admin', '/auth', '/cli', '/oauth', '/gallery'];
const PLACE_KEYS: Record<string, keyof LocalPlace> = {
  projectId: 'projectId',
  project_id: 'projectId',
  project: 'projectId',
  canvasId: 'canvasId',
  canvas_id: 'canvasId',
  canvas: 'canvasId'
};
const BEARER = /^Bearer\s+(\S+)$/i;
const SEE_OTHER = 303;
const FORBIDDEN = 403;
const TOKEN_MARGIN_S = 60;

export function localModeOn(env: Env): boolean {
  return env.FEEGA_LOCAL_MODE === '1';
}

export function localModeRefusal(env: Env): string | null {
  if (!localModeOn(env)) {
    return null;
  }
  if (env.VERCEL) {
    return 'FEEGA_LOCAL_MODE=1 refuses to run on Vercel: it signs every visitor in as the demo user. Unset it.';
  }
  const host = env.PUBLIC_APP_URL ? new URL(env.PUBLIC_APP_URL).hostname : LOCAL_HOSTS[0];
  if (!LOCAL_HOSTS.includes(host)) {
    return `FEEGA_LOCAL_MODE=1 needs PUBLIC_APP_URL on localhost or 127.0.0.1 (got ${env.PUBLIC_APP_URL}): it signs every visitor in as the demo user.`;
  }
  return null;
}

export function canvasPath(place: LocalPlace): string {
  return `/p/${place.projectId}/c/${place.canvasId}`;
}

function redirected(pathname: string): boolean {
  return pathname === ROOT || REDIRECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function foreignPlace(asked: unknown, place: LocalPlace): boolean {
  if (Array.isArray(asked)) {
    return asked.some((item) => foreignPlace(item, place));
  }
  if (!asked || typeof asked !== 'object') {
    return false;
  }
  return Object.entries(asked).some(([key, value]) => {
    const field = PLACE_KEYS[key];
    return typeof value === 'string' ? field !== undefined && value !== place[field] : foreignPlace(value, place);
  });
}

async function bodyOf(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('json')) {
    return null;
  }
  return request.clone().json().catch(() => null);
}

async function askedPlace(event: RequestEvent): Promise<unknown[]> {
  return [await bodyOf(event.request), Object.fromEntries(event.url.searchParams), event.params];
}

function demoCredentials(env: Env) {
  return { email: env.SEED_DEMO_EMAIL || DEFAULT_DEMO_EMAIL, password: env.SEED_DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD };
}

let cachedToken: { token: string; until: number } | null = null;

async function demoToken(env: Env): Promise<string> {
  const now = Date.now() / 1000;
  if (cachedToken && now < cachedToken.until) {
    return cachedToken.token;
  }
  const res = await fetch(`${env.PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.PUBLIC_SUPABASE_ANON_KEY ?? '', 'content-type': 'application/json' },
    body: JSON.stringify(demoCredentials(env))
  });
  if (!res.ok) {
    throw new Error(`Local mode: demo user sign-in failed (${res.status}). Run npm run db:seed with FEEGA_LOCAL_MODE=1.`);
  }
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: access_token, until: now + expires_in - TOKEN_MARGIN_S };
  return access_token;
}

let cachedPlace: LocalPlace | null = null;

async function localPlace(token: string): Promise<LocalPlace> {
  if (cachedPlace) {
    return cachedPlace;
  }
  const db = createUserDb(token);
  const { data: project } = await db.from('projects').select('id').eq('slug', LOCAL_PROJECT_SLUG).maybeSingle();
  const { data: canvas } = project
    ? await db.from('canvases').select('id').eq('project_id', project.id).is('deleted_at', null).order('created_at').limit(1).maybeSingle()
    : { data: null };
  if (!project || !canvas) {
    throw new Error('Local mode: no "Local" project. Run npm run db:seed with FEEGA_LOCAL_MODE=1.');
  }
  cachedPlace = { projectId: project.id, canvasId: canvas.id };
  return cachedPlace;
}

function hasSession(event: RequestEvent): boolean {
  return event.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));
}

async function signIn(event: RequestEvent, env: Env): Promise<void> {
  const client = createServerClient(env.PUBLIC_SUPABASE_URL ?? '', env.PUBLIC_SUPABASE_ANON_KEY ?? '', {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => cookies.forEach(({ name, value, options }) => event.cookies.set(name, value, { ...options, path: ROOT }))
    }
  });
  await client.auth.signInWithPassword(demoCredentials(env));
}

async function serveApi(event: RequestEvent, resolve: Resolve, token: string, place: LocalPlace): Promise<Response> {
  if (foreignPlace(await askedPlace(event), place)) {
    return json({ error: 'outside_local_project', message: `Local mode serves one project only: ${place.projectId}, canvas ${place.canvasId}.` }, { status: FORBIDDEN });
  }
  const bearer = BEARER.exec(event.request.headers.get('authorization') ?? '')?.[1];
  if (!bearer || bearer === LOCAL_MODE_TOKEN) {
    event.request.headers.set('authorization', `Bearer ${token}`);
  }
  return resolve(event);
}

export async function serveLocal(event: RequestEvent, resolve: Resolve, env: Env): Promise<Response> {
  const token = await demoToken(env);
  const place = await localPlace(token);

  if (event.url.pathname.startsWith(API_PREFIX)) {
    return serveApi(event, resolve, token, place);
  }

  if (redirected(event.url.pathname) || foreignPlace(event.params, place)) {
    redirect(SEE_OTHER, canvasPath(place));
  }
  if (!hasSession(event)) {
    await signIn(event, env);
  }
  return resolve(event);
}

export function shownProjects<T extends { id: string }>(projects: T[], currentId: string, env: Env): T[] {
  return localModeOn(env) ? projects.filter((p) => p.id === currentId) : projects;
}
