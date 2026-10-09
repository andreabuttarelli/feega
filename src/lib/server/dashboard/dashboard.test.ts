import { describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';
import { dashboardFor, videoPage, VIDEO_PAGE, type DashboardDeps } from './dashboard';
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
      { id: 'm1', projectId: 'a', canvasId: 'c1', name: 'Trailer', data: { format: 'landscape', posterAssetId: 'poster-1', lastRenderAssetId: 'render-1' }, updatedAt: '2026-10-03' },
      { id: 'm2', projectId: 'b', canvasId: 'c9', name: null, data: {}, updatedAt: '2026-10-02' }
    ]),
    signImages: vi.fn(async (_db: Db, _orgId: string, ids: string[]) => Object.fromEntries(ids.map((id) => [id, `https://signed/${id}`]))),
    signVideos: vi.fn(async (_db: Db, _orgId: string, ids: string[]) => Object.fromEntries(ids.map((id) => [id, `https://video/${id}`]))),
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
      { id: 'm1', name: 'Trailer', projectName: 'Project a', updatedAt: '2026-10-03', format: '16:9', poster: 'https://signed/poster-1', preview: 'https://video/render-1', href: '/p/a/c/c1/motion/m1' },
      { id: 'm2', name: 'Untitled video', projectName: 'Project b', updatedAt: '2026-10-02', format: '9:16', poster: null, preview: null, href: '/p/b/c/c9/motion/m2' }
    ]);
  });

  it('signs every picture in one round and every preview in another', async () => {
    const d = deps();
    await dashboardFor(db, d, 'org');
    expect(d.signImages).toHaveBeenCalledOnce();
    expect(d.signVideos).toHaveBeenCalledOnce();
    expect(d.signVideos).toHaveBeenCalledWith(db, 'org', ['render-1']);
  });

  it('a project card counts its videos and shows their latest posters', async () => {
    const [a, b] = (await dashboardFor(db, deps(), 'org')).projects;
    expect([a.videoCount, a.posters]).toEqual([1, ['https://signed/poster-1']]);
    expect([b.videoCount, b.posters]).toEqual([1, []]);
  });

  it('offers more videos only when a full page came back', async () => {
    expect((await dashboardFor(db, deps(), 'org')).moreVideos).toBeNull();

    const many = Array.from({ length: VIDEO_PAGE + 1 }, (_, i) => ({ id: `m${i}`, projectId: 'a', canvasId: 'c1', name: null, data: {}, updatedAt: `2026-10-03T00:00:${String(59 - i).padStart(2, '0')}Z` }));
    const { motions, moreVideos } = await dashboardFor(db, deps({ listRecentNodes: vi.fn(async () => many) }), 'org');
    expect(motions).toHaveLength(VIDEO_PAGE);
    expect(moreVideos).toBe(motions.at(-1)!.updatedAt);
  });
});

describe('the next page of videos', () => {
  it('reads motion nodes older than the cursor, signed in one round', async () => {
    const d = deps();
    const page = await videoPage(db, d, 'org', '2026-10-04');
    expect(d.listRecentNodes).toHaveBeenCalledWith(db, { orgId: 'org', type: 'motion', limit: VIDEO_PAGE + 1, before: '2026-10-04' });
    expect(page.videos.map((v) => v.id)).toEqual(['m1', 'm2']);
    expect(page.more).toBeNull();
    expect(d.signImages).toHaveBeenCalledOnce();
  });
});
