import { describe, expect, it, vi } from 'vitest';

const startProject = vi.fn(async () => ({ projectId: 'p1', canvasId: 'c1' }));
const assertPublicUrl = vi.fn(async () => undefined);

vi.mock('$lib/server/tenancy/entry', async (orig) => ({ ...(await orig<object>()), startProject: (...a: unknown[]) => startProject(...(a as [])) }));
vi.mock('$lib/server/tool-guard', async (orig) => ({ ...(await orig<object>()), assertPublicUrl: (...a: unknown[]) => assertPublicUrl(...(a as [])) }));

const route = await import('./+server');

async function call(body: unknown, signedIn = true) {
  const url = new URL('https://oh.feega.app/api/v1/start');
  const locals = { safeGetSession: async () => ({ user: signedIn ? { id: 'u1' } : null }), db: async () => ({}) };
  const res = await (route.POST as (e: unknown) => Promise<Response>)({ request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url, locals, cookies: { get: () => undefined } });
  return { status: res.status, body: await res.json() };
}

describe('POST /api/v1/start', () => {
  it('creates the site project for a valid url', async () => {
    const { status, body } = await call({ url: 'https://stripe.com' });

    expect(status).toBe(200);
    expect(body).toEqual({ projectId: 'p1', canvasId: 'c1' });
    expect(startProject.mock.calls[0]).toEqual(expect.arrayContaining(['https://stripe.com/']));
  });

  it('refuses an internal address before creating anything', async () => {
    startProject.mockClear();
    const { status } = await call({ url: 'http://169.254.169.254/' });

    expect(status).toBe(400);
    expect(startProject).not.toHaveBeenCalled();
  });

  it('refuses a host that resolves to a private address', async () => {
    startProject.mockClear();
    assertPublicUrl.mockRejectedValueOnce(new Error('That host is not reachable'));
    const { status } = await call({ url: 'https://rebind.example' });

    expect(status).toBe(400);
    expect(startProject).not.toHaveBeenCalled();
  });

  it('needs a session', async () => {
    expect((await call({ url: 'https://stripe.com' }, false)).status).toBe(401);
  });
});
