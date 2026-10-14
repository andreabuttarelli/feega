import { describe, expect, it, vi } from 'vitest';
import { MARKETING_PATHS } from '$lib/seo';

const createAdminClient = vi.fn(() => {
  throw new Error('the sitemap must not need the database');
});
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient }));
vi.mock('$lib/server/marketing-shell', () => ({ hideMarketing: () => false }));

const { GET } = await import('./+server');

describe('sitemap.xml', () => {
  it('lists the public pages, without touching the database', async () => {
    const res = await GET({ url: new URL('https://feega.app/sitemap.xml') } as never);
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain(`<loc>https://feega.app${MARKETING_PATHS[1] ?? '/'}</loc>`);
    expect(xml).not.toContain('/blog/');
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
