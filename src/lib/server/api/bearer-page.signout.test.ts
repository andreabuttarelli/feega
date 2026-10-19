import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db/client', () => ({ createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: vi.fn() }));

const { bearerEvent } = await import('./bearer-page');

describe('a page action over bearer', () => {
  it('signing out has no cookie to clear and does not throw (account deletion from the app ended in a 500 after deleting)', async () => {
    const user = { id: 'u1' } as never;
    const event = bearerEvent({ token: 't', db: {} as never, user }, new Request('https://x.test'), new URL('https://x.test/api'), '/p/p1/settings/profile');

    await expect(event.locals.supabase.auth.signOut({ scope: 'local' })).resolves.toEqual({ error: null });
    expect((await event.locals.supabase.auth.getUser()).data.user).toBe(user);
  });
});
