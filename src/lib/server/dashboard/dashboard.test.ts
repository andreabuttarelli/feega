import { describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { dashboardFor, type DashboardDeps } from './dashboard';
import type { Db } from '$lib/server/db/client';

const db = {} as Db;

const project = (id: string, mode = ProjectMode.Standard) => ({ id, name: `Project ${id}`, slug: id, brandId: null, archivedAt: null, lastActiveAt: `2026-10-0${id.length}T00:00:00Z`, mode });

function deps(overrides: Partial<DashboardDeps> = {}): DashboardDeps {
  return {
    listProjects: vi.fn(async () => [project('a'), project('secret', ProjectMode.Uncensored), project('b')]),
    listRecentCanvases: vi.fn(async () => [
      { id: 'c1', projectId: 'a', name: 'Launch', updatedAt: '2026-10-03' },
      { id: 'c2', projectId: 'a', name: 'Ideas', updatedAt: '2026-10-02' },
      { id: 'c3', projectId: 'secret', name: 'Hidden', updatedAt: '2026-10-01' }
    ]),
    listRecentImages: vi.fn(async () => [
      ...['i1', 'i2', 'i3', 'i4', 'i5'].map((id) => ({ id, projectId: 'a' })),
      { id: 'i6', projectId: 'secret' }
    ]),
    listRecentBatches: vi.fn(async () => [
      { id: 'b1', projectId: 'b', name: 'Autumn', status: 'running', createdAt: '2026-10-03' },
      { id: 'b2', projectId: 'secret', name: 'Hidden', status: 'running', createdAt: '2026-10-03' }
    ]),
    listRecentNodes: vi.fn(async () => [
      { id: 'm1', projectId: 'a', canvasId: 'c1', name: 'Trailer', data: { posterAssetId: 'poster-1' }, updatedAt: '2026-10-03' },
      { id: 'm2', projectId: 'b', canvasId: 'c9', name: null, data: {}, updatedAt: '2026-10-02' }
    ]),
    signImages: vi.fn(async (_db: Db, _orgId: string, ids: string[]) => Object.fromEntries(ids.map((id) => [id, `https://signed/${id}`]))),
    ...overrides
  };
}

describe('the dashboard: projects, tool outputs, one org', () => {
  it('lists standard projects only, most recent first, opening on the project', async () => {
    const dashboard = await dashboardFor(db, deps(), 'org');
    expect(dashboard.projects.map((p) => [p.id, p.href])).toEqual([
      ['a', '/p/a'],
      ['b', '/p/b']
    ]);
  });

  it('a project shows its recent canvases and up to four thumbnails', async () => {
    const [a] = (await dashboardFor(db, deps(), 'org')).projects;
    expect(a.canvases).toEqual([
      { id: 'c1', name: 'Launch', href: '/p/a/c/c1' },
      { id: 'c2', name: 'Ideas', href: '/p/a/c/c2' }
    ]);
    expect(a.thumbs).toEqual(['https://signed/i1', 'https://signed/i2', 'https://signed/i3', 'https://signed/i4']);
  });

  it('studio batches open their standalone page and never leak an uncensored project', async () => {
    const { batches } = await dashboardFor(db, deps(), 'org');
    expect(batches).toEqual([{ id: 'b1', name: 'Autumn', status: 'running', createdAt: '2026-10-03', projectName: 'Project b', href: '/app/studio/b1' }]);
  });

  it('motion videos open their editor on the canvas that holds them', async () => {
    const { motions } = await dashboardFor(db, deps(), 'org');
    expect(motions).toEqual([
      { id: 'm1', name: 'Trailer', projectName: 'Project a', updatedAt: '2026-10-03', poster: 'https://signed/poster-1', href: '/p/a/c/c1/motion/m1' },
      { id: 'm2', name: 'Untitled video', projectName: 'Project b', updatedAt: '2026-10-02', poster: null, href: '/p/b/c/c9/motion/m2' }
    ]);
  });

  it('signs every picture in one round', async () => {
    const d = deps();
    await dashboardFor(db, d, 'org');
    expect(d.signImages).toHaveBeenCalledOnce();
  });
});
