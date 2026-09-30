import { CONSENT_COOKIE, Tracker, allows, decodeConsent } from '$lib/consent-model';

type CookieJar = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, opts: { path: string; maxAge: number; httpOnly: boolean; sameSite: 'lax' }) => void;
};

const META_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 90;
const BLOG_ROUTE_PREFIXES = ['/_site', '/blog/[site]', '/blog-preview'];

export function seedMetaClickCookies(cookies: CookieJar, url: URL, routeId: string | null) {
  const fbclid = url.searchParams.get('fbclid');
  if (!fbclid) {
    return;
  }
  if (routeId && BLOG_ROUTE_PREFIXES.some((prefix) => routeId.startsWith(prefix))) {
    return;
  }
  if (!allows(decodeConsent(cookies.get(CONSENT_COOKIE)), Tracker.MetaPixel)) {
    return;
  }

  const opts = { path: '/', maxAge: META_COOKIE_MAX_AGE_S, httpOnly: false, sameSite: 'lax' as const };
  cookies.set('_fbc', `fb.1.${Date.now()}.${fbclid}`, opts);
  if (!cookies.get('_fbp')) {
    cookies.set('_fbp', `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`, opts);
  }
}
