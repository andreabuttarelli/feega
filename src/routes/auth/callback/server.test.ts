import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

const exchangeCodeForSession = vi.fn();
const landingPath = vi.fn(async () => '/p/proj1/c/canvas1');

vi.mock('$lib/server/feature-flags', () => ({ isPlanGoEnabled: () => true }));
vi.mock('$lib/server/oauth', () => ({ takeOAuthReturn: () => null }));
vi.mock('$lib/server/tenancy/landing', async (orig) => ({ ...(await orig<object>()), landingPath }));

const { GET } = await import('./+server');

const DB = { mocked: true };

async function redirectFor(query: string, db: unknown = null) {
  const event = {
    url: new URL(`https://feega.app/auth/callback${query}`),
    cookies: { get: () => undefined },
    locals: { supabase: { auth: { exchangeCodeForSession } }, db: async () => db }
  };

  try {
    await (GET as unknown as (event: unknown) => Promise<never>)(event);
  } catch (error) {
    if (isRedirect(error)) return { status: error.status, location: error.location };
    throw error;
  }

  throw new Error('Expected callback to redirect');
}

describe('OAuth callback', () => {
  it('returns to login with an error when code exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('code expired') });

    await expect(redirectFor('?code=expired')).resolves.toEqual({
      status: 303,
      location: '/login?error=link'
    });
  });

  it('returns to login with a visible error when the provider refuses or the user cancels', async () => {
    await expect(redirectFor('?error=access_denied&error_description=cancelled')).resolves.toEqual({
      status: 303,
      location: '/login?error=oauth'
    });
  });

  it('lands a first-time Google user on their canvas through the entry bootstrap', async () => {
    const user = { id: 'new-google-user', app_metadata: { provider: 'google' } };
    exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null });

    await expect(redirectFor('?code=ok', DB)).resolves.toEqual({
      status: 303,
      location: '/p/proj1/c/canvas1'
    });
    expect(landingPath).toHaveBeenCalledWith(DB, user, expect.anything(), null);
  });
});
