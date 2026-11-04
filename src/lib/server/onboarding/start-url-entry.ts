import { START_URL_PARAM } from '$lib/start-url';
import { rememberStartUrl } from './start-url-cookie';

const SELF_ROUTED = ['/login', '/auth/callback', '/auth/confirm', '/auth/reset-password'];
const AUTH_CODE_PARAM = 'code';

const START_URL_ALIAS = 'start_from';

type Jar = Parameters<typeof rememberStartUrl>[0];

export function carriesStartUrl(url: URL): boolean {
  return url.searchParams.has(START_URL_PARAM) || url.searchParams.has(START_URL_ALIAS);
}

function canonicalPath(url: URL): string | null {
  const alias = url.searchParams.get(START_URL_ALIAS);
  if (alias === null) {
    return null;
  }

  const query = new URLSearchParams(url.searchParams);
  query.delete(START_URL_ALIAS);
  query.set(START_URL_PARAM, alias);
  return `${url.pathname}?${query}`;
}

export async function startUrlRedirect(input: { url: URL; cookies: Jar; land: (() => Promise<string>) | null }): Promise<string | null> {
  const canonical = canonicalPath(input.url);
  if (canonical) {
    return canonical;
  }

  const startUrl = rememberStartUrl(input.cookies, input.url);
  if (!startUrl || SELF_ROUTED.includes(input.url.pathname) || input.url.searchParams.has(AUTH_CODE_PARAM)) {
    return null;
  }
  if (!input.land) {
    return `/login?${START_URL_PARAM}=${encodeURIComponent(startUrl)}`;
  }
  return input.land();
}
