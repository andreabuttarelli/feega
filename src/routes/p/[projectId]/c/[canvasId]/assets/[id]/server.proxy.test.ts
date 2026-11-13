import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { markRlsScoped } from '$lib/server/rls-client';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: vi.fn(async () => ({ orgId: 'org-1' })) }));
vi.mock('$lib/server/db/client', () => ({
  createServiceRoleDb: () => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed/${bucket}/${path}` })) })
      })
    }
  })
}));

const { GET } = await import('./+server');

const video = {
  id: 'v1', org_id: 'org-1', project_id: 'p1', type: 'video', url: 'org-1/p1/clip.mov', proxy_url: 'org-1/p1/clip.mov.proxy.mp4', content: null,
  mime_type: 'video/quicktime', bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: '2026-11-14'
};

function call(search: string) {
  const { db } = fakeDb({ assets: [video] }, { filter: true });
  const scoped = markRlsScoped(db);
  const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => scoped };
  const url = new URL(`http://localhost/p/p1/c/c1/assets/v1${search}`);
  return GET({ params: { projectId: 'p1', canvasId: 'c1', id: 'v1' }, locals, url } as never);
}

describe('a transcoded video plays from its proxy', () => {
  it('the proxy path of a row the caller can read is signed', async () => {
    const res = await call('?proxy=1');

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://signed/canvas-assets/org-1/p1/clip.mov.proxy.mp4');
  });
});
