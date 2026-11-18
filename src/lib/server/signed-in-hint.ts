export const SIGNED_IN_HINT = 'feega_signed_in';

const SHARED_DOMAIN = 'feega.app';
const HINT_MAX_AGE_S = 60 * 60 * 24 * 365;

export enum Session {
  Present,
  Absent
}

type CookieOpts = { path: string; domain?: string; maxAge?: number; httpOnly?: boolean; sameSite?: 'lax' };

type CookieJar = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, opts: CookieOpts) => void;
  delete: (name: string, opts: CookieOpts) => void;
};

function sharedDomain(hostname: string): string | undefined {
  if (hostname === SHARED_DOMAIN || hostname.endsWith(`.${SHARED_DOMAIN}`)) {
    return SHARED_DOMAIN;
  }

  return undefined;
}

export function syncSignedInHint(cookies: CookieJar, hostname: string, session: Session) {
  const hinted = cookies.get(SIGNED_IN_HINT) !== undefined;
  const domain = sharedDomain(hostname);

  if (session === Session.Present && !hinted) {
    cookies.set(SIGNED_IN_HINT, '1', { path: '/', domain, maxAge: HINT_MAX_AGE_S, httpOnly: false, sameSite: 'lax' });
    return;
  }

  if (session === Session.Absent && hinted) {
    cookies.delete(SIGNED_IN_HINT, { path: '/', domain });
  }
}
