import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { writeNodesBatch } from './batch-write';

const ORG = '11111111-1111-1111-1111-111111111111';
const CANVAS = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';
const STALE = '33333333-3333-3333-3333-333333333334';
const ACTOR = { kind: 'user' as const, id: 'user-1' };

const row = (id: string, version: number) => ({
  id,
  org_id: ORG,
  project_id: 'p',
  canvas_id: CANVAS,
  type: 'text',
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: { prompt: 'a', status: 'idle' },
  version,
  deleted_at: null
});

describe('writeNodesBatch', () => {
  it('merges each patch over the stored data and answers each node on its own', async () => {
    const { db, calls } = fakeDb({ nodes: [row(NODE, 2), row(STALE, 5)], canvas_events: [] }, { filter: true, mutate: true });

    const results = await writeNodesBatch(db, {
      orgId: ORG,
      canvasId: CANVAS,
      actor: ACTOR,
      items: [
        { node_id: NODE, version: 2, patch: { status: 'done' } },
        { node_id: STALE, version: 4, patch: { status: 'done' } },
        { node_id: 'missing', version: 1, patch: {} }
      ]
    });

    expect(results.map((r) => [r.nodeId, r.outcome])).toEqual([
      [NODE, 'written'],
      [STALE, 'conflict'],
      ['missing', 'not_found']
    ]);
    const update = calls.find((c) => c.op === 'update' && c.table === 'nodes');
    expect((update?.payload as { data: unknown }).data).toEqual({ prompt: 'a', status: 'done' });
  });
});
