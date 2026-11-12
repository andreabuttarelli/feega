import { describe, it, expect, vi } from 'vitest';

const ORG = '11111111-1111-4111-8111-111111111111';
const MAP = { rev: 'abc', pages: [{ path: '/', state: 'imported', boards: [{ cond: 'light@1280', clip: 'b1' }] }, { path: '/gone', state: 'imported', boards: [{ cond: 'light@1280', clip: 'deleted' }] }] };
const DOC = { tracks: [{ id: 't', clips: [{ id: 'b1' }] }], comps: {} };

vi.mock('$env/dynamic/private', () => ({ env: { GITHUB_TOKEN: 't' } }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: async () => ({ orgId: ORG, project: { id: 'p1' } }) }));
vi.mock('$lib/server/repos/canvas', async (actual) => ({ ...(await actual<object>()), findNode: async () => ({ id: 'f1', projectId: 'p1', data: { code: { kind: 'github', repo: 'a/b', branch: 'main', sha: 'abc', routes: ['/', '/gone'], map: MAP } } }) }));
vi.mock('$lib/server/motion/move-element', async (actual) => ({ ...(await actual<object>()), frameStore: () => ({ read: async () => ({ canvasId: 'c1', version: 1, doc: DOC, at: { x: 0, y: 0 } }) }) }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

describe('GET /api/v1/projects/:id/code-import/:nodeId/map', () => {
  it('answers the stored map and counts only the boards still in the frame against the limit', async () => {
    const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => ({}) };
    const url = new URL('https://feega.test/api/v1/projects/p1/code-import/f1/map');
    const res = await (route.GET as Handler)({ params: { projectId: 'p1', nodeId: 'f1' }, locals, request: new Request(url), url });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: 'github', repo: 'a/b', sha: 'abc', used: 1, limit: 20, map: MAP });
  });
});
