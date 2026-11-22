import { describe, expect, it } from 'vitest';
import { Route, cookieOf, forwardHeaders, loginUrl, routeOf, safeNext, visitCookie } from '../src/routing';

const SID = 'abcdefghij';
const BASE = 'localhost:8787';

describe('routeOf', () => {
  it('sends /host on any other host to the host endpoint', () => {
    expect(routeOf(new URL('http://127.0.0.1:8787/host?token=x'), BASE)).toEqual({ kind: Route.Host });
    expect(routeOf(new URL('https://relay.sessions.test/host'), 'sessions.test')).toEqual({ kind: Route.Host });
  });

  it('sends a sid host to the visitor path', () => {
    expect(routeOf(new URL(`http://${SID}.localhost:8787/a/b?c=1`), BASE)).toEqual({ kind: Route.Visitor, sid: SID });
  });

  it('sends the auth path on a sid host to the auth route', () => {
    expect(routeOf(new URL(`http://${SID}.localhost:8787/__feega/auth?token=t`), BASE)).toEqual({ kind: Route.Auth, sid: SID });
  });

  it('does not treat /host on a sid host as the host endpoint', () => {
    expect(routeOf(new URL(`http://${SID}.localhost:8787/host`), BASE)).toEqual({ kind: Route.Visitor, sid: SID });
  });

  it('knows nothing else', () => {
    expect(routeOf(new URL('http://127.0.0.1:8787/'), BASE)).toEqual({ kind: Route.None });
    expect(routeOf(new URL('https://evil.com/host'), 'sessions.test')).toEqual({ kind: Route.Host });
  });
});

describe('safeNext', () => {
  it('keeps a local path with its query', () => {
    expect(safeNext('/app?x=1#y')).toBe('/app?x=1#y');
  });

  it('falls back to / for anything that could leave the origin', () => {
    for (const next of [null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'app']) {
      expect(safeNext(next)).toBe('/');
    }
  });
});

describe('cookies', () => {
  it('builds a host-only HttpOnly Lax cookie', () => {
    const cookie = visitCookie('tok', 3600, 'https:');

    expect(cookie).toBe('feega_visit=tok; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax');
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('drops Secure on plain http for local development', () => {
    expect(visitCookie('tok', 60, 'http:')).not.toMatch(/Secure/);
  });

  it('reads a cookie by name', () => {
    expect(cookieOf('a=1; feega_visit=tok; b=2', 'feega_visit')).toBe('tok');
    expect(cookieOf('a=1', 'feega_visit')).toBeNull();
    expect(cookieOf(null, 'feega_visit')).toBeNull();
  });
});

describe('forwardHeaders', () => {
  it('removes the visit cookie, edge headers and spoofed feega headers', () => {
    const headers = new Headers({ cookie: 'a=1; feega_visit=secret; b=2', 'cf-connecting-ip': '1.1.1.1', 'x-feega-visitor': 'spoof', 'x-feega-exp': '1', accept: 'text/html', 'sec-fetch-dest': 'iframe' });

    expect(forwardHeaders(headers)).toEqual({ cookie: 'a=1; b=2', accept: 'text/html', 'sec-fetch-dest': 'iframe' });
  });

  it('drops the cookie header when only the visit cookie was in it', () => {
    expect(forwardHeaders(new Headers({ cookie: 'feega_visit=secret' }))).toEqual({});
  });
});

describe('loginUrl', () => {
  it('points at the web app session page with the path to return to', () => {
    expect(loginUrl('https://oh.feega.app', SID, '/a?b=1')).toBe(`https://oh.feega.app/s/${SID}?next=%2Fa%3Fb%3D1`);
  });
});
