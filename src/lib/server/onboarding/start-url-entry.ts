import { START_URL_PARAM } from '$lib/start-url';
import { rememberStartUrl } from './start-url-cookie';

const SELF_ROUTED = ['/login', '/auth/callback', '/auth/confirm', '/auth/reset-password'];
const AUTH_CODE_PARAM = 'code';

type Jar = Parameters<typeof rememberStartUrl>[0];

export async function startUrlRedirect(input: { url: URL; cookies: Jar; land: (() => Promise<string>) | null }): Promise<string | null> {
  const startUrl = rememberStartUrl(input.cookies, input.url);
  if (!startUrl || SELF_ROUTED.includes(input.url.pathname) || input.url.searchParams.has(AUTH_CODE_PARAM)) {
    return null;
  }
  if (!input.land) {
    return `/login?${START_URL_PARAM}=${encodeURIComponent(startUrl)}`;
  }
  return input.land();
}
