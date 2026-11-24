import type { Cookies } from '@sveltejs/kit';

const RETURN_COOKIE = 'feega_return';
const RETURN_PREFIX = '/s/';
const RETURN_MAX_AGE_SECONDS = 600;

export function stashReturn(cookies: Cookies, path: string): void {
  cookies.set(RETURN_COOKIE, path, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: RETURN_MAX_AGE_SECONDS });
}

export function takeReturn(cookies: Cookies): string | null {
  const value = cookies.get(RETURN_COOKIE);
  if (!value) {
    return null;
  }

  cookies.delete(RETURN_COOKIE, { path: '/' });

  return value.startsWith(RETURN_PREFIX) ? value : null;
}
