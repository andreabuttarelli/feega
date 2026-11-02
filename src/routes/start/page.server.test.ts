import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

const assertPublicUrl = vi.fn(async () => undefined);
const createProject = vi.fn(async () => ({ id: 'p1' }));
const createCanvas = vi.fn(async () => ({ id: 'c1' }));

vi.mock('$lib/server/tool-guard', async (orig) => ({ ...(await orig<object>()), assertPublicUrl: (...a: unknown[]) => assertPublicUrl(...(a as [])) }));
vi.mock('$lib/server/tenancy/entry', async (orig) => {
  const real = await orig<typeof import('$lib/server/tenancy/entry')>();
  return {
    ...real,
    ENTRY_DEPS: { ...real.ENTRY_DEPS, ensureProfile: async () => undefined, listMemberships: async () => [{ org: { id: 'o1' }, role: 'owner' }], createProject, createCanvas }
  };
});

const { load } = await import('./+page.server');

async function run(path: string, signedIn = true) {
  try {
    return await (load as (e: unknown) => Promise<unknown>)({ url: new URL(`https://oh.feega.app${path}`), cookies: { get: () => undefined }, locals: { db: async () => ({}), safeGetSession: async () => ({ user: signedIn ? { id: 'u', email: 'u@x.io' } : null }) } });
  } catch (error) {
    if (isRedirect(error)) {
      return { location: error.location };
    }
    throw error;
  }
}

describe('/start', () => {
  it('opens a new canvas for the site, carrying the url so the canvas imports it', async () => {
    expect(await run('/start?start_url=https%3A%2F%2Fwww.stripe.com')).toEqual({ location: `/p/p1/c/c1?start_url=${encodeURIComponent('https://www.stripe.com/')}` });
    expect(createProject).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orgId: 'o1', name: 'stripe.com', brandId: null }));
    expect(createCanvas).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ projectId: 'p1' }));
  });

  it('refuses a host that resolves to a private address before creating anything', async () => {
    createProject.mockClear();
    assertPublicUrl.mockRejectedValueOnce(new Error('That host is not reachable'));

    expect(await run('/start?start_url=https%3A%2F%2Frebind.example')).toEqual({ location: '/app' });
    expect(createProject).not.toHaveBeenCalled();
  });

  it('signed out, it goes to sign in carrying the url', async () => {
    expect(await run('/start?start_url=https%3A%2F%2Fstripe.com', false)).toEqual({ location: `/login?start_url=${encodeURIComponent('https://stripe.com/')}` });
  });

  it('without a usable url there is nothing to start: home', async () => {
    expect(await run('/start?start_url=javascript%3Aalert(1)')).toEqual({ location: '/app' });
  });
});
