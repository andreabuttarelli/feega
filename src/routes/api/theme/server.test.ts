import { describe, expect, it, vi } from 'vitest';
import { THEME_COOKIE } from '$lib/theme';

const { PUT } = await import('./+server');

function event(body: unknown, signedIn = true) {
  const updateUser = vi.fn(async (_attrs: { data: Record<string, unknown> }) => ({ error: null }));
  const set = vi.fn();
  return {
    updateUser,
    set,
    ev: {
      request: new Request('http://x/api/theme', { method: 'PUT', body: JSON.stringify(body) }),
      cookies: { set },
      locals: { safeGetSession: async () => ({ session: signedIn ? {} : null, user: signedIn ? { id: 'u' } : null }), supabase: { auth: { updateUser } } }
    } as never
  };
}

describe('saving the theme', () => {
  it('writes the account metadata and the cookie the server reads on the next load', async () => {
    const { ev, updateUser, set } = event({ theme: 'dark' });
    const res = await PUT(ev);
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ data: { theme: 'dark' } });
    expect(set).toHaveBeenCalledWith(THEME_COOKIE, 'dark', expect.objectContaining({ path: '/' }));
  });

  it('refuses a theme that does not exist', async () => {
    const { ev } = event({ theme: 'blue' });
    expect((await PUT(ev)).status).toBe(400);
  });

  it('signed out, it only sets the cookie', async () => {
    const { ev, updateUser, set } = event({ theme: 'light' }, false);
    expect((await PUT(ev)).status).toBe(200);
    expect(updateUser).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
  });
});
