import { START_URL_PARAM, startUrlOf, startUrlRefusal } from '$lib/start-url';

export const START_URL_COOKIE = 'feega_start_url';

const START_URL_COOKIE_MAX_AGE_S = 30 * 60;
const COOKIE_PATH = '/';

type CookieJar = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, opts: { path: string; maxAge: number; httpOnly: boolean; sameSite: 'lax'; secure: boolean }) => void;
  delete: (name: string, opts: { path: string }) => void;
};

export const START_URL_ENTRIES = ['/', '/login', '/app', '/auth/callback', '/auth/confirm', '/auth/reset-password'];

export function rememberStartUrl(cookies: Pick<CookieJar, 'set'>, url: URL): string | null {
  if (!START_URL_ENTRIES.includes(url.pathname)) {
    return null;
  }

  const raw = url.searchParams.get(START_URL_PARAM);
  const startUrl = startUrlOf(raw);
  if (!startUrl) {
    if (raw !== null) {
      console.warn(`start_url refused (${startUrlRefusal(raw)}): ${raw.slice(0, 200)}`);
    }
    return null;
  }

  cookies.set(START_URL_COOKIE, startUrl, {
    path: COOKIE_PATH,
    maxAge: START_URL_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:'
  });
  return startUrl;
}

export function peekStartUrl(cookies: Pick<CookieJar, 'get'>): string | null {
  return startUrlOf(cookies.get(START_URL_COOKIE));
}

export function takeStartUrl(cookies: Pick<CookieJar, 'get' | 'delete'>): string | null {
  const startUrl = peekStartUrl(cookies);
  if (cookies.get(START_URL_COOKIE) !== undefined) {
    cookies.delete(START_URL_COOKIE, { path: COOKIE_PATH });
  }
  return startUrl;
}
