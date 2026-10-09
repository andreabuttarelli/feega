import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: vi.fn(async () => ({ orgId: 'org-1', canvas: { id: 'c1', projectId: 'p1' } })) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: vi.fn(async () => true) }));
vi.mock('$lib/server/repos/asset-storage', () => ({ CANVAS_REDIRECT_MAX_AGE_S: 60, signAssetFile: vi.fn(async (_db: unknown, path: string) => `https://signed.example/${path}`) }));

const { GET } = await import('./+server');

function call(params: Record<string, string>) {
  const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => ({}) };
  return GET({ params: { projectId: 'p1', canvasId: 'c1', ...params }, locals } as never);
}

describe('GET a picture the agent looked at', () => {
  it('redirects to the signed file under this project', async () => {
    const res = await call({ callId: 'v1', file: '0.jpg' });

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://signed.example/org-1/p1/web-views/v1/0.jpg');
  });

  it('refuses a path that tries to leave the folder', async () => {
    await expect(call({ callId: '..', file: '0.jpg' })).rejects.toMatchObject({ status: 404 });
    await expect(call({ callId: 'v1', file: '../x.png' })).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a canvas of another project', async () => {
    await expect(call({ projectId: 'p2', callId: 'v1', file: '0.jpg' })).rejects.toMatchObject({ status: 404 });
  });
});
