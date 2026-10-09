import { describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

vi.mock('$lib/server/repos/projects', () => ({ listProjects: vi.fn(async () => [{ id: 'p1', name: 'Launch', slug: 'launch', brandId: null, archivedAt: null, lastActiveAt: '2026-10-03', mode: ProjectMode.Standard }]), createProject: vi.fn() }));

const listRecentNodes = vi.fn(async () => [{ id: 'm9', projectId: 'p1', canvasId: 'c1', name: 'Older', data: { posterAssetId: 'a1' }, updatedAt: '2026-09-01' }]);
vi.mock('$lib/server/repos/dashboard', () => ({ listRecentNodes, listRecentCanvases: vi.fn(), listRecentImages: vi.fn(), listRecentBatches: vi.fn() }));

const signedAssets = vi.fn(async (_db: unknown, _org: string, ids: string[]) => ({ assets: new Map(), urls: Object.fromEntries(ids.map((id) => [id, `https://signed/${id}`])) }));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets }));

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => [{ org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' }]) }));

const { GET } = await import('./+server');

const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => ({}) };

function get(url: string) {
  return GET({ locals, cookies: { get: () => undefined }, url: new URL(url) } as never);
}

describe('/app/videos hands the dashboard its next page', () => {
  it('reads videos older than the cursor in the chosen org, posters signed', async () => {
    const page = await (await get('http://x/app/videos?before=2026-10-01')).json();

    expect(listRecentNodes).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orgId: 'org-a', before: '2026-10-01' }));
    expect(page.videos.map((v: { id: string; poster: string }) => [v.id, v.poster])).toEqual([['m9', 'https://signed/a1']]);
    expect(page.more).toBeNull();
  });

  it('refuses a request without a cursor', async () => {
    await expect(get('http://x/app/videos')).rejects.toMatchObject({ status: 400 });
  });
});
