import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { NodeRun } from '$lib/server/repos/node-runs';

vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async () => ({ id: 'node-1', projectId: 'project-1', canvasId: 'canvas-1', displayName: 'Launch' })
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'project-1', brandId: null }) }));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readRevision: async () => {
    const { newMotionDoc, MotionFormat } = await import('$lib/motion/doc');
    return { version: 2, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' };
  }
}));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/assets')>()),
  listProjectAssets: async () => [{ id: 'img-1', type: 'image', source: 'upload', url: 'org-1/project-1/a.png', createdAt: '2026-10-07', mimeType: 'image/png' }]
}));

import { linkPayload } from './render-link';

describe('linkPayload', () => {
  it('firma gli asset col client del link: chi apre il link non ha una sessione da usare come prova', async () => {
    const { db } = fakeDb({});
    const run = { id: 'run-1', orgId: 'org-1', nodeId: 'node-1', params: { revision: 2 } } as unknown as NodeRun;

    const payload = await linkPayload(db, run);

    expect(payload?.assetUrls).toEqual({ 'img-1': expect.stringContaining('org-1/project-1/a.png') });
  });
});
