import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db/client', () => ({ createUserDb: vi.fn() }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: vi.fn() }));

const { pageEvent } = await import('./bearer-page');

const user = { id: 'u1' };
const db = { from: (table: string) => `rows of ${table}`, auth: { getUser: async () => ({ data: { user: null }, error: new Error('no session') }) } };

describe('a page event built from a bearer token', () => {
  const event = pageEvent({ token: 't', db: db as never, user: user as never }, new Request('https://x/api'), new URL('https://x/api/v1/me/pages/credits?org=o1&action=a&checkout=success'), '/app/credits');

  it('answers the legacy getUser with the verified bearer user, keeping the RLS client', async () => {
    const supabase = event.locals.supabase as unknown as typeof db;
    expect((await supabase.auth.getUser()).data.user).toBe(user);
    expect(supabase.from('orgs')).toBe('rows of orgs');
  });

  it('carries the page query, the workspace as the org cookie, and drops the API params', () => {
    expect(event.url.pathname).toBe('/app/credits');
    expect(event.url.search).toBe('?checkout=success');
    expect(event.cookies.get('dz-org')).toBe('o1');
  });
});
