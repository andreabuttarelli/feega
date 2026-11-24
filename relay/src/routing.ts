import { sidOfHost } from '../../packages/share-protocol/src/sid';
import { AUTH_PATH, HOST_PATH, VISIT_COOKIE, VISITOR_HEADER } from '../../packages/share-protocol/src/visitor';

export enum Route {
  Host = 'host',
  Visitor = 'visitor',
  Auth = 'auth',
  None = 'none'
}

export type Routed = { kind: Route.Host } | { kind: Route.Visitor; sid: string } | { kind: Route.Auth; sid: string } | { kind: Route.None };

const INTERNAL_PREFIX = 'x-feega-';
const EDGE_PREFIX = 'cf-';
const LOCAL_PATH = /^\/(?![/\\])/;

export function routeOf(url: URL, visitorBase: string): Routed {
  const sid = sidOfHost(url.host, visitorBase);
  if (sid) {
    return url.pathname === AUTH_PATH ? { kind: Route.Auth, sid } : { kind: Route.Visitor, sid };
  }
  return url.pathname === HOST_PATH ? { kind: Route.Host } : { kind: Route.None };
}

export const safeNext = (next: string | null) => (next && LOCAL_PATH.test(next) ? next : '/');

export const visitCookie = (token: string, maxAgeSeconds: number, protocol: string) => {
  const secure = protocol === 'https:' ? ' Secure;' : '';
  return `${VISIT_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly;${secure} SameSite=Lax`;
};

const cookiePairs = (header: string) => header.split(';').map((pair) => pair.trim());

export function cookieOf(header: string | null, name: string): string | null {
  const prefix = `${name}=`;
  const pair = cookiePairs(header ?? '').find((p) => p.startsWith(prefix));
  return pair ? pair.slice(prefix.length) : null;
}

const withoutVisitCookie = (header: string) => cookiePairs(header).filter((pair) => pair !== '' && !pair.startsWith(`${VISIT_COOKIE}=`)).join('; ');

export function forwardHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    if (name.startsWith(EDGE_PREFIX) || name.startsWith(INTERNAL_PREFIX) || name === VISITOR_HEADER) {
      return;
    }
    const kept = name === 'cookie' ? withoutVisitCookie(value) : value;
    if (kept !== '') {
      out[name] = kept;
    }
  });
  return out;
}

export const loginUrl = (webOrigin: string, sid: string, path: string) => `${webOrigin}/s/${sid}?next=${encodeURIComponent(path)}`;

export const snapshotUrl = (webOrigin: string, sid: string) => `${webOrigin}/s/${sid}`;

export const offlineUrl = (webOrigin: string, sid: string) => `${snapshotUrl(webOrigin, sid)}?offline=1`;

export const isPageVisit = (headers: Headers) => (headers.get('accept') ?? '').includes('text/html');
