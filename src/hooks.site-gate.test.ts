import { describe, expect, it, vi } from 'vitest';

const privateEnv: Record<string, string | undefined> = {};
const publicEnv: Record<string, string | undefined> = { PUBLIC_SUPABASE_URL: 'https://example.supabase.co' };

vi.mock('$env/dynamic/private', () => ({ env: privateEnv }));
vi.mock('$env/dynamic/public', () => ({ env: publicEnv }));

const { siteGate } = await import('./hooks.server');

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh) Chrome/140 Electron/38.2.0 FeegaNative/0.1.0';
const MOBILE_UA = 'Mozilla/5.0 (iPhone) AppleWebKit/605 FeegaNative/1.0';

const request = async (routeId: string, userAgent = 'Mozilla/5.0 Chrome/140') => {
  try {
    const res = await siteGate({
      event: { url: new URL('https://oh.feega.app/terms'), route: { id: routeId }, request: new Request('https://oh.feega.app/terms', { headers: { 'user-agent': userAgent } }) },
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

describe('the desktop app has no marketing pages', () => {
  it('sends every marketing route to the app, even where the site is on', async () => {
    Object.assign(privateEnv, { VERCEL_ENV: 'preview' });
    for (const route of ['/(site)', '/(site)/[page=landing]', '/(site)/[doc=legal]', '/(public)/changelog', '/(public)/docs/[...slug]']) {
      expect(await request(route, DESKTOP_UA)).toBe('303 /app');
    }
  });

  it('keeps the app routes', async () => {
    expect(await request('/login', DESKTOP_UA)).toBe(200);
    expect(await request('/p/[projectId]', DESKTOP_UA)).toBe(200);
  });

  it('leaves the browser and the mobile app alone', async () => {
    Object.assign(privateEnv, { VERCEL_ENV: 'preview' });
    expect(await request('/(public)/changelog')).toBe(200);
    expect(await request('/(public)/changelog', MOBILE_UA)).toBe(200);
  });
});
