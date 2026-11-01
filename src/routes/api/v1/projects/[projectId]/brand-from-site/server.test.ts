import { describe, expect, it, vi } from 'vitest';
import { BrandFromSite } from '$lib/server/start/brand-from-site';

const brandFromSite = vi.fn();

vi.mock('$lib/server/projects/project-scope', () => ({ projectScopeOf: async () => ({ db: {}, orgId: 'o1', projectId: 'p1', userId: 'u1' }) }));
vi.mock('$lib/server/start/brand-from-site', async (orig) => ({ ...(await orig<object>()), brandFromSite: (...a: unknown[]) => brandFromSite(...a) }));
vi.mock('$lib/server/start/live-brand-ports', () => ({ liveBrandPorts: () => ({}) }));

const route = await import('./+server');

async function call(body: unknown) {
  const url = new URL('https://oh.feega.app/api/v1/projects/p1/brand-from-site');
  const res = await (route.POST as (e: unknown) => Promise<Response>)({ request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url, locals: {}, params: { projectId: 'p1' } });
  return { status: res.status, body: await res.json() };
}

describe('POST /api/v1/projects/:id/brand-from-site', () => {
  it('runs the analysis for the project canvas and answers with the brand', async () => {
    brandFromSite.mockResolvedValue({ outcome: BrandFromSite.Created, brandId: 'b1', frameId: 'f1' });

    const { status, body } = await call({ canvasId: 'c1', url: 'https://stripe.com', x: 1600, y: 0 });

    expect(status).toBe(200);
    expect(body).toEqual({ outcome: 'created', brandId: 'b1', frameId: 'f1' });
    expect(brandFromSite.mock.calls[0].slice(0, 3)).toEqual([{ orgId: 'o1', projectId: 'p1', canvasId: 'c1' }, 'https://stripe.com/', { x: 1600, y: 0 }]);
  });

  it('a failed analysis is an error the page can show, not a 200', async () => {
    brandFromSite.mockResolvedValue({ outcome: BrandFromSite.Failed, error: 'credits_exhausted' });

    const { status, body } = await call({ canvasId: 'c1', url: 'https://stripe.com', x: 0, y: 0 });

    expect(status).toBe(502);
    expect(body.error).toBe('credits_exhausted');
  });

  it('refuses an internal url', async () => {
    expect((await call({ canvasId: 'c1', url: 'http://localhost', x: 0, y: 0 })).status).toBe(400);
  });
});
