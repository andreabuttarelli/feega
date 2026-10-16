import { describe, expect, it, vi } from 'vitest';

const canvases = [{ id: 'c1', name: 'Board', projectName: 'Launch', updatedAt: '2026-10-03', href: '/p/p1/c/c1', thumbs: [] }];
const dashboardFor = vi.fn(async () => ({ canvases, projects: [], batches: [], motions: [], moreVideos: null }));
vi.mock('$lib/server/dashboard/dashboard', () => ({ DASHBOARD_DEPS: {}, dashboardFor }));

const { load } = await import('$lib/server/dashboard/pages/canvases');

const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => ({}) };

describe('/app/canvases', () => {
  it('lists the recent canvases of the chosen workspace', async () => {
    const data = (await load({ locals, parent: async () => ({ org: { id: 'org-a' } }) } as never)) as { canvases: typeof canvases };

    expect(dashboardFor).toHaveBeenCalledWith({}, {}, 'org-a');
    expect(data.canvases).toEqual(canvases);
  });
});
