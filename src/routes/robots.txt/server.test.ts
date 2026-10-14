import { describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn(() => {
  throw new Error('robots.txt must not need the database');
});
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient }));

const { GET } = await import('./+server');

describe('robots.txt', () => {
  it('points crawlers at the one sitemap and keeps them out of the app, without touching the database', async () => {
    const body = await (await GET({ url: new URL('https://feega.app/robots.txt') } as never)).text();

    expect(body).toContain('Sitemap: https://feega.app/sitemap.xml');
    expect(body).toContain('Disallow: /app');
    expect(body).not.toContain('/blog/');
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
