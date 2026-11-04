import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { WATERMARK_CLIP_ID } from '@feega/motion-core/motion/watermark';
import type { NodeRun } from '$lib/server/repos/node-runs';

vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async () => ({ id: 'node-1', projectId: 'project-1', canvasId: 'canvas-1', displayName: 'Launch' })
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'project-1', brandId: null }) }));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readCheckpoint: async () => {
    const { newMotionDoc, MotionFormat } = await import('@feega/motion-core/motion/doc');
    return { version: 2, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' };
  }
}));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/assets')>()),
  listProjectAssets: async () => []
}));

import { linkPayload } from './render-link';

async function clipIds(subscription: string | null): Promise<string[]> {
  const { db } = fakeDb({ orgs: [{ id: 'org-1', stripe_subscription_id: subscription }] }, { filter: true });
  const payload = await linkPayload(db, { id: 'run-1', orgId: 'org-1', nodeId: 'node-1', params: { revision: 2 } } as unknown as NodeRun);
  return payload?.doc.tracks.flatMap((t) => t.clips.map((c) => c.id)) ?? [];
}

describe('a browser render link', () => {
  it('hands a free org the doc with the watermark', async () => {
    expect(await clipIds(null)).toContain(WATERMARK_CLIP_ID);
  });

  it('hands a paid org the doc clean', async () => {
    expect(await clipIds('sub_1')).not.toContain(WATERMARK_CLIP_ID);
  });
});
