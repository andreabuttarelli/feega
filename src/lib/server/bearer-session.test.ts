import { describe, expect, it } from 'vitest';
import { bearerSession, bearerTokenOf } from './bearer-session';

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
