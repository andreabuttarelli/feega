import { describe, expect, it, vi } from 'vitest';

const privateEnv: Record<string, string | undefined> = {};
const publicEnv: Record<string, string | undefined> = { PUBLIC_SUPABASE_URL: 'https://example.supabase.co' };

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$env/dynamic/public', () => ({ env: publicEnv }));

const { siteGate } = await import('./hooks.server');

const request = async (routeId: string) => {
  try {
    const res = await siteGate({
      event: { url: new URL('https://oh.feega.app/terms'), route: { id: routeId } },
      resolve: async () => new Response('site')
    } as never);
    return res.status;
  } catch (e) {
    const thrown = e as { status?: number; location?: string };
    return thrown.location ? `${thrown.status} ${thrown.location}` : thrown.status;
  }
};

describe('the rebuilt marketing site stays hidden in production', () => {
  it('production sends a site page to the app', async () => {
    Object.assign(privateEnv, { VERCEL_ENV: 'production' });
    Object.assign(publicEnv, { PUBLIC_SITE_ENABLED: undefined });
    expect(await request('/(site)/[doc=legal]')).toBe('303 /app');
  });

  it('production keeps serving the app', async () => {
    Object.assign(privateEnv, { VERCEL_ENV: 'production' });
    expect(await request('/login')).toBe(200);
  });

  it('the flag turns the site on in production', async () => {
    Object.assign(privateEnv, { VERCEL_ENV: 'production' });
    Object.assign(publicEnv, { PUBLIC_SITE_ENABLED: 'true' });
    expect(await request('/(site)/[doc=legal]')).toBe(200);
  });

  it('a preview deploy serves it', async () => {
    Object.assign(privateEnv, { VERCEL_ENV: 'preview' });
    Object.assign(publicEnv, { PUBLIC_SITE_ENABLED: undefined });
    expect(await request('/(site)/[doc=legal]')).toBe(200);
  });
});
