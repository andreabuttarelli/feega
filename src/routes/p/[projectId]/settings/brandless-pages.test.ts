import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/tenancy', () => ({ hasManyTenants: () => true }));
vi.mock('$lib/server/supabase-admin', () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: [] }) };
  return { createAdminClient: () => ({ from: () => q }) };
});

const PAGES = {
  'connected-accounts': () => import('./connected-accounts/+page.server'),
  danger: () => import('./danger/+page.server')
};

const event = {
  parent: async () => ({ brand: null, isOwner: true }),
  url: new URL('https://feega.test/p/x/settings'),
  params: { projectId: 'x' },
  locals: {
    supabase: {},
    safeGetSession: async () => ({ user: { id: 'user-1', email: 'a@b.c' } })
  }
};

describe('una pagina di impostazioni senza brand non risponde 500', () => {
  it.each(Object.keys(PAGES) as (keyof typeof PAGES)[])('%s carica con brand null', async (section) => {
    const { load } = await PAGES[section]();

    await expect((load as (e: unknown) => Promise<unknown>)(event)).resolves.toBeDefined();
  });
});
