import { describe, expect, it } from 'vitest';
import { START_URL_COOKIE, peekStartUrl, rememberStartUrl, takeStartUrl } from './start-url-cookie';

function jar(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const sets: { name: string; opts: Record<string, unknown> }[] = [];
  return {
    store,
    sets,
    get: (name: string) => store.get(name),
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      store.set(name, value);
      sets.push({ name, opts });
    },
    delete: (name: string) => {
      store.delete(name);
    }
  };
}

describe('the start url survives the trip through sign-in', () => {
  it('is kept in a short-lived httpOnly lax cookie', () => {
    const cookies = jar();
    rememberStartUrl(cookies, new URL('https://oh.feega.app/?start_url=https%3A%2F%2Fstripe.com'));

    expect(cookies.store.get(START_URL_COOKIE)).toBe('https://stripe.com/');
    expect(cookies.sets[0].opts).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, maxAge: 1800, path: '/' });
  });

  it('a refused url is never stored', () => {
    const cookies = jar();
    rememberStartUrl(cookies, new URL('https://oh.feega.app/?start_url=javascript%3Aalert(1)'));

    expect(cookies.store.has(START_URL_COOKIE)).toBe(false);
  });

  it('the parameter carried by the auth redirect overrides an older cookie, and taking it clears it', () => {
    const cookies = jar({ [START_URL_COOKIE]: 'https://old.com/' });
    rememberStartUrl(cookies, new URL('https://oh.feega.app/auth/callback?code=x&start_url=https%3A%2F%2Fstripe.com'));

    expect(takeStartUrl(cookies)).toBe('https://stripe.com/');
    expect(cookies.store.has(START_URL_COOKIE)).toBe(false);
  });

  it.each(['/login', '/app', '/auth/callback', '/auth/confirm', '/'])('%s is an entry that keeps it', (path) => {
    const cookies = jar();
    rememberStartUrl(cookies, new URL(`https://oh.feega.app${path}?start_url=https%3A%2F%2Fstripe.com`));

    expect(cookies.store.get(START_URL_COOKIE)).toBe('https://stripe.com/');
  });

  it('any other page ignores it', () => {
    const cookies = jar();
    rememberStartUrl(cookies, new URL('https://oh.feega.app/p/1/c/2?start_url=https%3A%2F%2Fstripe.com'));

    expect(cookies.store.has(START_URL_COOKIE)).toBe(false);
  });

  it('the cookie carries it when the redirect lost the parameter', () => {
    const cookies = jar({ [START_URL_COOKIE]: 'https://stripe.com/' });

    expect(takeStartUrl(cookies)).toBe('https://stripe.com/');
    expect(takeStartUrl(cookies)).toBeNull();
  });

  it('a tampered cookie is revalidated', () => {
    const cookies = jar({ [START_URL_COOKIE]: 'http://169.254.169.254/' });

    expect(takeStartUrl(cookies)).toBeNull();
  });

  it('peeking leaves it for the callback', () => {
    const cookies = jar({ [START_URL_COOKIE]: 'https://stripe.com/' });

    expect(peekStartUrl(cookies)).toBe('https://stripe.com/');
    expect(cookies.store.has(START_URL_COOKIE)).toBe(true);
  });
});
