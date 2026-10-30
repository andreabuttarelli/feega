import { describe, expect, it, vi } from 'vitest';
import { START_URL_COOKIE } from './start-url-cookie';
import { startUrlRedirect } from './start-url-entry';

function cookies() {
  const store = new Map<string, string>();
  return { store, get: (n: string) => store.get(n), set: (n: string, v: string) => void store.set(n, v), delete: (n: string) => void store.delete(n) };
}

const STRIPE = 'start_url=https%3A%2F%2Fstripe.com';

describe('the website entry routes the visitor before anything else', () => {
  it('a signed-out visitor goes to sign in with the url still in the address', async () => {
    const jar = cookies();
    const to = await startUrlRedirect({ url: new URL(`https://oh.feega.app/?${STRIPE}`), cookies: jar, land: null });

    expect(to).toBe(`/login?start_url=${encodeURIComponent('https://stripe.com/')}`);
    expect(jar.store.get(START_URL_COOKIE)).toBe('https://stripe.com/');
  });

  it('a signed-in visitor on /app goes straight to the landing that runs the import', async () => {
    const land = vi.fn(async () => '/p/s/c/c?start_url=x');

    const to = await startUrlRedirect({ url: new URL(`https://oh.feega.app/app?${STRIPE}`), cookies: cookies(), land });

    expect(to).toBe('/p/s/c/c?start_url=x');
  });

  it('the login page and the auth callbacks keep it but route themselves', async () => {
    for (const path of ['/login', '/auth/callback', '/auth/confirm']) {
      const jar = cookies();
      expect(await startUrlRedirect({ url: new URL(`https://oh.feega.app${path}?${STRIPE}`), cookies: jar, land: vi.fn() })).toBeNull();
      expect(jar.store.get(START_URL_COOKIE)).toBe('https://stripe.com/');
    }
  });

  it('an OAuth code landing on the root is left to the callback', async () => {
    const jar = cookies();
    expect(await startUrlRedirect({ url: new URL(`https://oh.feega.app/?code=abc&${STRIPE}`), cookies: jar, land: null })).toBeNull();
    expect(jar.store.get(START_URL_COOKIE)).toBe('https://stripe.com/');
  });

  it('a refused url changes nothing', async () => {
    expect(await startUrlRedirect({ url: new URL('https://oh.feega.app/?start_url=javascript:alert(1)'), cookies: cookies(), land: null })).toBeNull();
  });
});
