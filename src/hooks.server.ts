import { staleSessionCookieNames } from '$lib/server/stale-session-cookies';
import {sequence} from '@sveltejs/kit/hooks';
import { json, redirect, text } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import { busyAnswer } from '$lib/db-busy';
import type { CookieOptions } from '@supabase/ssr';
import { createServerClient } from '$lib/server/db/connect';
import { outlivesTurn } from '$lib/server/session-life';
import { markRlsScoped } from '$lib/server/rls-client';
import { createUserDb, type Db } from '$lib/server/db/client';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { isCsrfForbidden } from '$lib/server/csrf';
import { redirectFor } from '$lib/server/host-redirects';
import { corsPreflight, extraOrigins, withCors } from '$lib/server/api-cors';
import { SessionSource, bearerSession, bearerTokenOf, sessionSourceOf } from '$lib/server/bearer-session';
import { landingUrlFor } from '$lib/marketing';
import type { RequestEvent } from '@sveltejs/kit';
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_S, THEME_METADATA_KEY, ThemePref, htmlThemeAttrs, parseThemePref } from '$lib/theme';
import { Session, syncSignedInHint } from '$lib/server/signed-in-hint';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const SESSION_COOKIE_NAME = `sb-${new URL(publicEnv.PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const SESSION_COOKIE_PREFIX = `${SESSION_COOKIE_NAME}.`;
const BASE64_COOKIE_PREFIX = 'base64-';
const BASE64_URL = /^[A-Za-z0-9_-]*$/;

// '/' con o senza slash finale: la homepage che non esiste più.
export function isRootPath(pathname: string): boolean {
  return !pathname.replace(/\/$/, '');
}

function isSessionCookie(name: string): boolean {
  return name === SESSION_COOKIE_NAME || name.startsWith(SESSION_COOKIE_PREFIX);
}

async function rootRedirectTarget(event: RequestEvent): Promise<string> {
  const { session, user } = await event.locals.safeGetSession();
  return session && user ? '/app' : '/login';
}

function isValidSessionCookie(cookie: { name: string; value: string }): boolean {
  if (!isSessionCookie(cookie.name) || !cookie.value.startsWith(BASE64_COOKIE_PREFIX)) return true;
  return BASE64_URL.test(cookie.value.slice(BASE64_COOKIE_PREFIX.length));
}

function validSessionCookies(cookies: { name: string; value: string }[]) {
  if (cookies.every(isValidSessionCookie)) return cookies;
  return cookies.filter(({ name }) => !isSessionCookie(name));
}

// Replaces kit's built-in CSRF check (disabled in svelte.config.js) so /oauth/token can opt out —
// see $lib/server/csrf for why.
const PERMANENT_REDIRECT = 308;

const cors: Handle = async ({ event, resolve }) => {
  const extra = extraOrigins(privateEnv.API_EXTRA_ORIGINS);
  const preflight = corsPreflight(event.request, extra);
  if (preflight) {
    return preflight;
  }
  return withCors(event.request, await resolve(event), extra);
};

const hostRedirect: Handle = async ({ event, resolve }) => {
  const target = redirectFor(event.url);
  if (target) {
    throw redirect(PERMANENT_REDIRECT, target);
  }
  return resolve(event);
};

const MOVED_PERMANENTLY = 301;

export const marketingRedirect: Handle = async ({ event, resolve }) => {
  const target = landingUrlFor(event.url);
  if (target) {
    throw redirect(MOVED_PERMANENTLY, target);
  }
  return resolve(event);
};

const csrf: Handle = async ({ event, resolve }) => {
  if (isCsrfForbidden(event.request, event.url)) {
    const message = `Cross-site ${event.request.method} form submissions are forbidden`;
    return event.request.headers.get('accept') === 'application/json'
      ? json({ message }, { status: 403 })
      : text(message, { status: 403 });
  }
  return resolve(event);
};

const DASHBOARD_PREFIX = '/app';

async function refuseSignedOutDashboard(event: RequestEvent): Promise<void> {
  const path = event.url.pathname;
  if (path !== DASHBOARD_PREFIX && !path.startsWith(`${DASHBOARD_PREFIX}/`)) {
    return;
  }
  const { session } = await event.locals.safeGetSession();
  if (!session) {
    throw redirect(303, '/login');
  }
}

export const handle: Handle = sequence(cors, hostRedirect, marketingRedirect, csrf, Sentry.sentryHandle(), async ({ event, resolve }) => {
  // Per-request Supabase client bound to the request cookies (SSR auth).
  // Marchiato come RLS-scoped: chiave anon, quindi Postgres valuta le policy dell'utente. È la
  // dichiarazione su cui `query` decide di leggere — vedi $lib/server/rls-client.
  staleSessionCookieNames(event.cookies.getAll().map(({ name }) => name), SESSION_COOKIE_NAME).forEach((name) => event.cookies.delete(name, { path: '/' }));
  const hasSessionCookie = validSessionCookies(event.cookies.getAll()).some(({ name }) => isSessionCookie(name));
  syncSignedInHint(event.cookies, event.url.hostname, hasSessionCookie ? Session.Present : Session.Absent);
  const requestBearer = bearerTokenOf(event.request);
  const source = sessionSourceOf(event.request, event.url);
  event.locals.supabase = markRlsScoped(createServerClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_ANON_KEY, {
    ...(requestBearer ? { global: { headers: { Authorization: `Bearer ${requestBearer}` } } } : {}),
    cookies: {
      getAll: () => (source === SessionSource.Cookie ? validSessionCookies(event.cookies.getAll()) : []),
      setAll: (cookiesToSet: CookieToSet[]) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            // path '/' so the session cookie is valid across the whole app
            event.cookies.set(name, value, { ...options, path: '/' });
          } catch {
            // Supabase's auto token-refresh fires setAll asynchronously; on fast routes
            // that finish before it resolves (e.g. /sitemap.xml) the response is already
            // generated and SvelteKit throws. The set is a no-op then — the refreshed
            // token simply persists on the next request — so swallow it rather than let
            // it surface as an unhandled rejection.
          }
        });
      }
    }
  }));

  // getSession() is local (cookie → JWT). getUser() hits GoTrue — cache it across SPA
  // navigations on this isolate so every click is not a 300–800ms auth RTT.
  const verifyBearer = async (token: string) => (await import('$lib/server/nav-cache')).verifiedToken(createUserDb(token), token);
  let cachedSession: ReturnType<typeof getSession> | null = null;
  const getSession = async () => {
    if (requestBearer) return bearerSession(requestBearer, verifyBearer);
    if (source === SessionSource.None) return { session: null, user: null };
    const {
      data: { session: stored }
    } = await event.locals.supabase.auth.getSession();
    if (!stored) return { session: null, user: null };
    const session = outlivesTurn(stored) ? stored : ((await event.locals.supabase.auth.refreshSession()).data.session ?? stored);

    const { verifiedUser } = await import('$lib/server/nav-cache');
    const user = await verifiedUser(event.locals.supabase, session);
    if (!user) return { session: null, user: null };

    return { session, user };
  };
  event.locals.safeGetSession = () => (cachedSession ??= getSession());

  // Il database NUOVO, accanto al vecchio e non al posto suo: 103 file leggono ancora
  // `locals.supabase`, e spegnerlo qui vorrebbe dire non compilare più. Questo è tipizzato su
  // `database.types.ts` e porta il JWT della sessione, quindi la RLS gira sull'utente vero.
  // Pigro: una richiesta che non tocca il nuovo schema non paga niente.
  let cachedDb: Db | null | undefined;
  event.locals.db = async () => {
    if (cachedDb !== undefined) return cachedDb;
    const { session } = await event.locals.safeGetSession();
    cachedDb = session ? createUserDb(session.access_token) : null;
    return cachedDb;
  };

  if (isRootPath(event.url.pathname)) {
    if (event.url.searchParams.has('code') || event.url.searchParams.has('error_description')) {
      throw redirect(303, `/auth/callback${event.url.search}`);
    }
    throw redirect(302, await rootRedirectTarget(event));
  }

  await refuseSignedOutDashboard(event);

  const themePref = await themePrefFor(event);
  const doResolve = () =>
    resolve(event, {
      transformPageChunk: ({ html }) => {
        let out = html.replace('<html', `<html${htmlThemeAttrs(themePref)}`);
        // Keep in sync with +layout.svelte — scopes landing.css away from /app on SSR too.
        if (event.url.pathname.startsWith('/app') || event.url.pathname.startsWith('/c') || event.url.pathname.startsWith('/p/')) {
          out = out.replace('<html', '<html data-shell="app"');
        }
        return out;
      },
      filterSerializedResponseHeaders: (name) =>
        name === 'content-range' || name === 'x-supabase-api-version'
    });

  return doResolve();
});
export const handleError = Sentry.handleErrorWithSentry((({ error, event, status }) => {
  console.error('unhandled server error', { route: event.route.id, url: event.url.pathname + event.url.search, status, error });
  return busyAnswer(error);
}) satisfies HandleServerError);

async function themePrefFor(event: RequestEvent): Promise<ThemePref> {
  const cookie = event.cookies.get(THEME_COOKIE);
  if (cookie) {
    return parseThemePref(cookie);
  }
  const { user } = await event.locals.safeGetSession();
  const saved = user?.user_metadata?.[THEME_METADATA_KEY];
  if (!saved) {
    return ThemePref.System;
  }
  const pref = parseThemePref(saved);
  event.cookies.set(THEME_COOKIE, pref, { path: '/', maxAge: THEME_COOKIE_MAX_AGE_S, httpOnly: false, sameSite: 'lax' });
  return pref;
}
