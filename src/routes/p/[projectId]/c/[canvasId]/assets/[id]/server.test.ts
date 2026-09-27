import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: vi.fn(async () => ({ orgId: 'org-1' })) }));
vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: vi.fn(() => ({})),
  signAssetPaths: vi.fn(async () => new Map())
}));

const { GET } = await import('./+server');

const PUBLIC_SWATCH = 'https://x.supabase.co/storage/v1/object/public/media/colours/org-1/c0392b.png';

function asset(overrides: Record<string, unknown>) {
  return {
    id: 'a1', org_id: 'org-1', project_id: null, type: 'image', url: PUBLIC_SWATCH, content: null, mime_type: 'image/png',
    bytes: null, width: null, height: null, duration_s: null, source: 'imported', source_node_id: null, created_at: '2026-09-27',
    ...overrides
  };
}

function call(row: Record<string, unknown>) {
  const { db } = fakeDb({ assets: [row] }, { filter: true });
  const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db };
  return GET({ params: { projectId: 'p1', canvasId: 'c1', id: 'a1' }, locals } as never);
}

describe('GET canvas asset', () => {
  it('un asset importato con un url pubblico va a quell url, non a una firma che non esiste', async () => {
    const res = await call(asset({}));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(PUBLIC_SWATCH);
  });

  it('un asset caricato senza firma resta 404', async () => {
    await expect(call(asset({ source: 'upload', url: 'org-1/p1/x.png' }))).rejects.toMatchObject({ status: 404 });
  });
});
