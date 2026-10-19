import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ apiBase: null as string | null }));
const createClient = vi.fn(() => ({ kind: 'storage' }));
const createBrowserClient = vi.fn(() => ({ kind: 'cookies' }));

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://ref.supabase.co', PUBLIC_SUPABASE_ANON_KEY: 'anon' } }));
vi.mock('$lib/api/bundle-fetch', () => ({ bundleApiBase: () => state.apiBase }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('@supabase/ssr', () => ({ createBrowserClient }));

const { createSupabaseBrowserClient } = await import('./client');

beforeEach(() => {
  state.apiBase = null;
  createClient.mockClear();
  createBrowserClient.mockClear();
  vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
});

describe('the browser Supabase client', () => {
  it('on the web shares the SSR cookie session', () => {
    expect(createSupabaseBrowserClient()).toEqual({ kind: 'cookies' });
  });

  it('in the native bundle keeps the session in localStorage (capacitor:// has no cookies: sign-in succeeded and was forgotten)', () => {
    state.apiBase = 'https://feega.app';

    createSupabaseBrowserClient();

    expect(createBrowserClient).not.toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledWith('https://ref.supabase.co', 'anon', {
      auth: expect.objectContaining({ storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' })
    });
  });
});
