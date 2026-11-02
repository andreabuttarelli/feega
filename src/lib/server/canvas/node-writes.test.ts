import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';

const resized: { width: number; height: number }[] = [];

vi.mock('$lib/server/repos/canvas', async (original) => ({
  ...(await original<typeof import('$lib/server/repos/canvas')>()),
  listNodes: async () => [{ id: 'f', type: 'motion', data: { format: 'custom', docHeadRevision: 1 } }],
  resizeNode: async (_db: Db, input: { width: number; height: number }) => {
    resized.push({ width: input.width, height: input.height });
  }
}));

const { resizeOnCanvas } = await import('./node-writes');

describe('ridimensionare una tile sul server', () => {
  it('un frame stretto a 150×100 resta 150×100, non torna alla misura di partenza', async () => {
    await resizeOnCanvas({} as Db, { orgId: 'o', canvasId: 'c', nodeId: 'f', width: 150, height: 100 });

    expect(resized.at(-1)).toEqual({ width: 150, height: 100 });
  });
});
