import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { tarOf } from '$lib/code-upload/tar';
import { snapshotSha } from '$lib/server/code-import/upload-source';
import { importCodeAt } from '$lib/server/code-import/import-code';
import { askOf } from '$lib/server/code-import/code-import.testkit';

const ORG = '11111111-1111-4111-8111-111111111111';
const PATH = `${ORG}/33333333-3333-4333-8333-333333333333/code-uploads/44444444-4444-4444-8444-444444444444/my-app`;
const archive = gzipSync(tarOf([{ path: 'my-app/package.json', bytes: strToU8('{}') }]));

async function imported(routes: string[]): Promise<MotionDoc> {
  const { ask, docs } = askOf({ routes });
  await importCodeAt(ask);
  return docs.get('frame-1')!.doc as MotionDoc;
}

const LOCAL = await imported(['/', '/settings']);
const PIECE = await imported(['/pricing']);
const MAP = { pages: [{ path: '/', state: 'imported', boards: [{ cond: 'light@1280', clip: 'n2' }] }, { path: '/settings', state: 'imported', boards: [{ cond: 'light@1280', clip: 'n17' }] }] };

const importRepoAt = vi.fn();
const writes: MotionDoc[] = [];
const patches: unknown[] = [];

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: async () => ({ orgId: ORG, project: { id: 'p1' } }) }));
vi.mock('$lib/server/repos/canvas', async (actual) => ({
  ...(await actual<object>()),
  findNode: async (_db: unknown, { nodeId }: { nodeId: string }) => ({ id: nodeId, projectId: 'p1', data: { code: { kind: 'upload', repo: PATH, branch: null, sha: snapshotSha(archive), routes: ['/', '/settings'], map: MAP } } }),
  patchNodeData: async (_db: unknown, ask: unknown) => void patches.push(ask)
}));
vi.mock('$lib/server/motion/move-element', async (actual) => ({
  ...(await actual<object>()),
  frameStore: () => ({
    read: async (id: string) => ({ canvasId: 'c1', version: 3, doc: id === 'fresh' ? PIECE : LOCAL, at: { x: 0, y: 0 } }),
    write: async (_id: string, version: number, doc: MotionDoc) => (writes.push(doc), { outcome: 'written', version: version + 1 }),
    remove: async () => undefined
  })
}));
vi.mock('$lib/server/code-import/import-code', async (actual) => ({ ...(await actual<object>()), importRepoAt: (...args: unknown[]) => importRepoAt(...args) }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

async function call(body: unknown) {
  const db = { storage: { from: () => ({ download: async () => ({ data: new Blob([archive]), error: null }) }) } };
  const locals = { safeGetSession: async () => ({ user: { id: crypto.randomUUID() } }), db: async () => db };
  const url = new URL('https://feega.test/api/v1/projects/p1/code-import');
  const res = await (route.POST as Handler)({ params: { projectId: 'p1' }, locals, request: new Request(url, { method: 'POST', body: JSON.stringify(body) }), url });
  return { res, body: await res.json() };
}

beforeEach(() => {
  writes.splice(0);
  importRepoAt.mockResolvedValue({ outcome: 'ok', frameId: 'fresh', name: 'my-app', undo: [], skipped: [], locked: [], truncated: false, pages: ['/pricing'], boards: [{ label: '/pricing', route: '/pricing', cond: 'light@1280', clip: 'n1' }], components: 1, variants: 2, instances: 2 });
});

describe('POST /api/v1/projects/:id/code-import with into', () => {
  it('adds the asked page to the same frame and answers with the frame and its map', async () => {
    const { res, body } = await call({ canvasId: 'c1', into: 'f1', routes: ['/pricing'], x: 0, y: 0 });

    expect(res.status).toBe(200);
    expect(importRepoAt.mock.calls.at(-1)![0]).toMatchObject({ variants: [{ route: '/pricing' }] });
    expect(writes).toHaveLength(1);
    expect(clipsOf(writes[0]).filter((c) => c.parent === 'n1')).toHaveLength(3);
    expect(body.nodes[0].id).toBe('f1');
    expect(body.map.pages.find((p: { path: string }) => p.path === '/pricing').state).toBe('imported');
  });

  it('hands the editor the new page when it asks to land it itself', async () => {
    const { body } = await call({ canvasId: 'c1', into: 'f1', routes: ['/pricing'], land: 'piece', x: 0, y: 0 });

    expect(writes).toHaveLength(0);
    expect(body).toMatchObject({ boards: ['n1'], parent: 'n1' });
    expect(body.piece.width).toBe(PIECE.width);
  });

  it('refuses a source next to into: the frame already says where its code is', async () => {
    const { res } = await call({ canvasId: 'c1', into: 'f1', repo: 'https://github.com/a/b', routes: ['/pricing'], x: 0, y: 0 });

    expect(res.status).toBe(400);
  });
});
