import { VISIT_COOKIE, VISITOR_HEADER, encodeVisitor } from '../../packages/share-protocol/src/visitor';
import { verifyToken, type Claims } from '../../packages/share-protocol/src/token';
import { EXP_HEADER, INTENT_HEADER, Intent, SID_HEADER, type Env } from './env';
import { Route, cookieOf, loginUrl, routeOf, safeNext, visitCookie } from './routing';

export { Session } from './session';

const MS = 1000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UPGRADE_REQUIRED = 426;
const HTTP_FOUND = 302;
const FALLBACK_NAME = 'Guest';
const INTERNAL_PREFIX = 'x-feega-';

const isUpgrade = (request: Request) => request.headers.get('upgrade')?.toLowerCase() === 'websocket';

const text = (status: number, body: string) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

const stubOf = (env: Env, sid: string) => env.SESSION.get(env.SESSION.idFromName(sid));

function internalRequest(request: Request, set: Record<string, string>): Request {
  const headers = new Headers(request.headers);
  [...headers.keys()].filter((name) => name.startsWith(INTERNAL_PREFIX)).forEach((name) => headers.delete(name));
  Object.entries(set).forEach(([name, value]) => headers.set(name, value));
  return new Request(request, { headers });
}

async function host(request: Request, env: Env): Promise<Response> {
  if (!isUpgrade(request)) {
    return text(HTTP_UPGRADE_REQUIRED, 'websocket required');
  }
  const verified = await verifyToken(new URL(request.url).searchParams.get('token') ?? '', env.RELAY_SIGNING_SECRET);
  if (!verified.ok) {
    return text(HTTP_UNAUTHORIZED, 'invalid token');
  }
  if (verified.claims.role !== 'host') {
    return text(HTTP_FORBIDDEN, 'host token required');
  }
  const { sid, exp } = verified.claims;
  return stubOf(env, sid).fetch(internalRequest(request, { [INTENT_HEADER]: Intent.Host, [EXP_HEADER]: String(exp * MS) }));
}

async function auth(url: URL, sid: string, env: Env): Promise<Response> {
  const verified = await verifyToken(url.searchParams.get('token') ?? '', env.RELAY_SIGNING_SECRET);
  if (!verified.ok) {
    return text(HTTP_UNAUTHORIZED, 'invalid token');
  }
  if (verified.claims.sid !== sid || verified.claims.role === 'host') {
    return text(HTTP_FORBIDDEN, 'token is not for this session');
  }
  const token = url.searchParams.get('token')!;
  const maxAge = verified.claims.exp - Math.floor(Date.now() / MS);
  const headers = { location: safeNext(url.searchParams.get('next')), 'set-cookie': visitCookie(token, maxAge, url.protocol) };
  return new Response(null, { status: HTTP_FOUND, headers });
}

async function visitorOf(request: Request, sid: string, env: Env): Promise<Claims | null> {
  const token = cookieOf(request.headers.get('cookie'), VISIT_COOKIE);
  const verified = token ? await verifyToken(token, env.RELAY_SIGNING_SECRET) : null;
  return verified?.ok && verified.claims.sid === sid && verified.claims.role !== 'host' ? verified.claims : null;
}

async function visitor(request: Request, sid: string, env: Env): Promise<Response> {
  const claims = await visitorOf(request, sid, env);
  if (!claims) {
    const url = new URL(request.url);
    return isUpgrade(request) ? text(HTTP_UNAUTHORIZED, 'sign in required') : Response.redirect(loginUrl(env.WEB_ORIGIN, sid, url.pathname + url.search), HTTP_FOUND);
  }
  const info = { userId: claims.sub, name: claims.name ?? FALLBACK_NAME, role: claims.role as 'editor' | 'viewer' };
  return stubOf(env, sid).fetch(internalRequest(request, { [INTENT_HEADER]: Intent.Visitor, [SID_HEADER]: sid, [VISITOR_HEADER]: encodeVisitor(info) }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = routeOf(url, env.VISITOR_BASE);
    if (route.kind === Route.Host) {
      return host(request, env);
    }
    if (route.kind === Route.Auth) {
      return auth(url, route.sid, env);
    }
    if (route.kind === Route.Visitor) {
      return visitor(request, route.sid, env);
    }
    return text(HTTP_NOT_FOUND, 'not found');
  }
} satisfies ExportedHandler<Env>;
