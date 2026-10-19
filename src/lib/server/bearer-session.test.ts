import { describe, expect, it } from 'vitest';
import { SessionSource, bearerSession, bearerTokenOf, sessionSourceOf } from './bearer-session';

const USER = { id: 'u1', email: 'ada@x.it' };
const verify = async (token: string) => (token === 'jwt' ? (USER as never) : null);

describe('a request without a session cookie can sign in with a bearer', () => {
  it('reads the token from the authorization header only', () => {
    expect(bearerTokenOf(new Request('https://x', { headers: { authorization: 'Bearer jwt' } }))).toBe('jwt');
    expect(bearerTokenOf(new Request('https://x'))).toBeNull();
    expect(bearerTokenOf(new Request('https://x', { headers: { authorization: 'Basic abc' } }))).toBeNull();
  });

  it('a verified token is a session for its user, carrying the token', async () => {
    expect(await bearerSession('jwt', verify)).toMatchObject({ user: USER, session: { access_token: 'jwt', user: USER } });
  });

  it('a token that does not verify is no session at all', async () => {
    expect(await bearerSession('bad', verify)).toEqual({ session: null, user: null });
  });
});

describe('which credential a request is signed in with', () => {
  const API = new URL('https://feega.app/api/v1/me/root');
  const req = (headers: Record<string, string>) => new Request(API, { headers });

  it('a bearer wins, whatever cookie travels with it', () => {
    expect(sessionSourceOf(req({ authorization: 'Bearer jwt', cookie: 'sb=x', origin: 'tauri://localhost' }), API)).toBe(SessionSource.Bearer);
  });

  it('a same-origin or navigation request uses the cookie', () => {
    expect(sessionSourceOf(req({ cookie: 'sb=x', origin: 'https://feega.app' }), API)).toBe(SessionSource.Cookie);
    expect(sessionSourceOf(req({ cookie: 'sb=x' }), API)).toBe(SessionSource.Cookie);
  });

  it('a cross-origin request with only a cookie is not signed in, even from a bundle origin', () => {
    expect(sessionSourceOf(req({ cookie: 'sb=x', origin: 'tauri://localhost' }), API)).toBe(SessionSource.None);
    expect(sessionSourceOf(req({ cookie: 'sb=x', origin: 'https://evil.example' }), API)).toBe(SessionSource.None);
  });
});
