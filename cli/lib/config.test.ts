import { afterEach, describe, expect, test } from 'bun:test';
import { appUrl, authServerUrl, PRODUCTION_URL } from './config.ts';

const original = process.env.PUBLIC_APP_URL;
afterEach(() => {
  if (original === undefined) delete process.env.PUBLIC_APP_URL;
  else process.env.PUBLIC_APP_URL = original;
});

describe('appUrl', () => {
  // The apex 308s to www, and fetch drops Authorization across origins — every API call made
  // against the apex comes back 401 "Missing or invalid Authorization header".
  test('production base is the canonical www host, never the redirecting apex', () => {
    expect(PRODUCTION_URL).toBe('https://oh.feega.app');
    delete process.env.PUBLIC_APP_URL;
    expect(appUrl()).toBe('https://oh.feega.app');
  });

  test('an explicit PUBLIC_APP_URL wins, trailing slash stripped', () => {
    process.env.PUBLIC_APP_URL = 'http://localhost:5173/';
    expect(appUrl()).toBe('http://localhost:5173');
  });
});

describe('authServerUrl', () => {
  test('never advertises the apex: it 308-redirects and discovery dies there', () => {
    delete process.env.PUBLIC_APP_URL;
    expect(authServerUrl()).toBe('https://oh.feega.app');
    expect(authServerUrl()).toBe(appUrl());
  });

  test('follows a local dev server so local OAuth works', () => {
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    expect(authServerUrl()).toBe('http://localhost:5173');
  });
});

describe('supabase pubblico', () => {
  test('punta al progetto vivo, non a quello di dazero', async () => {
    const { SUPABASE_URL } = await import('./config.ts');
    expect(SUPABASE_URL).toBe('https://klnswzhhgrqvbfjzioul.supabase.co');
  });
});
