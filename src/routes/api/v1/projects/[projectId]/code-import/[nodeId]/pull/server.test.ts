import { describe, it, expect, vi } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import { tarOf } from '$lib/code-upload/tar';
import { snapshotSha } from '$lib/server/code-import/upload-source';

const ORG = '11111111-1111-4111-8111-111111111111';
const PATH = `${ORG}/33333333-3333-4333-8333-333333333333/code-uploads/44444444-4444-4444-8444-444444444444/my-app`;
const archive = gzipSync(tarOf([{ path: 'my-app/package.json', bytes: strToU8('{}') }]));
const importRepoAt = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: vi.fn(async () => []) }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: async () => ({ orgId: ORG, project: { id: 'p1' } }) }));
vi.mock('$lib/server/repos/canvas', async (actual) => ({ ...(await actual<object>()), findNode: async () => ({ id: 'f1', projectId: 'p1', data: { code: { kind: 'upload', repo: PATH, branch: null, sha: snapshotSha(archive), routes: ['/'] } } }) }));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({ read: async () => ({ canvasId: 'c1', version: 1, doc: {}, at: { x: 0, y: 0 } }) }) }));
vi.mock('$lib/server/code-import/import-code', async (actual) => ({ ...(await actual<object>()), importRepoAt: (...args: unknown[]) => importRepoAt(...args) }));

const route = await import('./+server');

type Handler = (event: unknown) => Promise<Response>;

describe('POST /api/v1/projects/:id/code-import/:nodeId/pull', () => {
  it('una cartella caricata una volta è sempre aggiornata: niente da rieseguire', async () => {
    const db = { storage: { from: () => ({ download: async () => ({ data: new Blob([archive]), error: null }) }) } };
    const locals = { safeGetSession: async () => ({ user: { id: 'u1' } }), db: async () => db };
    const url = new URL('https://feega.test/api/v1/projects/p1/code-import/f1/pull');
    const res = await (route.POST as Handler)({ params: { projectId: 'p1', nodeId: 'f1' }, locals, request: new Request(url, { method: 'POST', body: '{}' }), url });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'up_to_date', sha: snapshotSha(archive) });
    expect(importRepoAt).not.toHaveBeenCalled();
  });
});
