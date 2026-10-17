import { isActionFailure, isHttpError, isRedirect, json } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import { createUserDb, type Db } from '$lib/server/db/client';
import { verifiedToken } from '$lib/server/nav-cache';
import { appShell } from '$lib/server/dashboard/app-shell';
import { ORG_COOKIE } from '$lib/server/tenancy/context';

const OK = 200;
const UNAUTHORIZED = 401;

export const ORG_PARAM = 'org';
export const ACTION_PARAM = 'action';
export const PATH_PARAM = 'path';

const API_PARAMS = new Set([ORG_PARAM, ACTION_PARAM, PATH_PARAM]);

export type Bearer = { token: string; db: Db; user: User };

export async function bearerOf(request: Request): Promise<Bearer | Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'missing_bearer' }, { status: UNAUTHORIZED });
  }

  const db = createUserDb(token);
  const user = await verifiedToken(db, token);
  if (!user) {
    return json({ error: 'invalid_token' }, { status: UNAUTHORIZED });
  }
  return { token, db, user };
}

export function bearerEvent(bearer: Bearer, request: Request, apiUrl: URL, pagePath: string, params: Record<string, string> = {}) {
  const org = apiUrl.searchParams.get(ORG_PARAM) ?? undefined;
  const url = new URL(pagePath, apiUrl);
  for (const [key, value] of apiUrl.searchParams) {
    if (!API_PARAMS.has(key)) {
      url.searchParams.append(key, value);
    }
  }

  const locals = {
    safeGetSession: async () => ({ session: { access_token: bearer.token }, user: bearer.user }),
    db: async () => bearer.db,
    supabase: withVerifiedUser(bearer.db, bearer.user)
  };
  const cookies = { get: (name: string) => (name === ORG_COOKIE ? org : undefined), getAll: () => [], set: () => {}, delete: () => {} };
  return { request, url, params, locals, cookies, route: { id: null }, depends: () => {}, untrack: <T>(fn: () => T) => fn(), setHeaders: () => {} };
}

export function pageEvent(bearer: Bearer, request: Request, apiUrl: URL, pagePath: string, params: Record<string, string> = {}) {
  const event = bearerEvent(bearer, request, apiUrl, pagePath, params);
  return { ...event, parent: () => appShell(event as never) };
}

function withVerifiedUser(db: Db, user: User): Db {
  const auth = { getUser: async () => ({ data: { user }, error: null }) };
  return Object.assign(Object.create(db) as Db, { auth });
}

export async function answerOf(run: () => Promise<unknown>): Promise<Response> {
  try {
    const result = await run();
    if (isActionFailure(result)) {
      return json(result.data ?? {}, { status: result.status });
    }
    return json({ data: result ?? null }, { status: OK });
  } catch (e) {
    if (isRedirect(e)) {
      return json({ redirect: e.location }, { status: OK });
    }
    if (isHttpError(e)) {
      return json({ error: e.body.message }, { status: e.status });
    }
    throw e;
  }
}

export async function bareAnswerOf(run: () => Promise<unknown>): Promise<Response> {
  const enveloped = await answerOf(run);
  if (enveloped.status !== OK) {
    return enveloped;
  }
  const body = (await enveloped.json()) as { data?: unknown; redirect?: string };
  return json(body.redirect ? { redirect: body.redirect } : (body.data ?? null), { status: OK });
}
