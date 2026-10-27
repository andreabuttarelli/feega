import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { Edge } from '$lib/motion/space';
import { alignTiles } from '$lib/canvas/align';
import { arrangeNodes } from './arrange';

const ORG = 'org';
const ACTOR = { kind: 'agent' as const, id: 'user', agentKey: 'mcp' };

const row = (id: string, x: number, y: number, width: number | null = 100, height: number | null = 50) => ({
  id, canvas_id: 'canvas', project_id: 'project', type: 'text', display_name: null, x, y, z: 0, width, height, data: {}, version: 1, org_id: ORG, deleted_at: null
});

const setup = (rows: ReturnType<typeof row>[]) => fakeDb({ nodes: rows, nodes_connections: [], canvas_events: [] }, { store: true, filter: true });

describe('arranging nodes', () => {
  it('writes the new position of every tile the plan moves, and only those', async () => {
    const fake = setup([row('a', 0, 0), row('b', 200, 100)]);

    const out = await arrangeNodes(fake.db, { orgId: ORG, canvasId: 'canvas', nodeIds: ['a', 'b'], actor: ACTOR, plan: (tiles) => alignTiles(tiles, Edge.Left) });

    expect(out).toEqual({ moved: [{ id: 'b', x: 0, y: 100 }], missing: [] });
    const updates = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({ x: 0, y: 100, actor_kind: 'agent', agent_key: 'mcp' });
  });

  it('reports ids that are not on the canvas instead of ignoring them', async () => {
    const fake = setup([row('a', 0, 0), row('b', 200, 100)]);

    const out = await arrangeNodes(fake.db, { orgId: ORG, canvasId: 'canvas', nodeIds: ['a', 'b', 'ghost'], actor: ACTOR, plan: (tiles) => alignTiles(tiles, Edge.Left) });

    expect(out.missing).toEqual(['ghost']);
  });

  it('sizes a node that has no stored size by its type', async () => {
    const fake = setup([row('a', 0, 0, null, null), row('b', 0, 0, 10, 10)]);
    let seen: { width: number; height: number }[] = [];

    await arrangeNodes(fake.db, { orgId: ORG, canvasId: 'canvas', nodeIds: ['a', 'b'], actor: ACTOR, plan: (tiles) => ((seen = [...tiles]), []) });

    expect(seen[0].width).toBeGreaterThan(10);
    expect(seen[1]).toMatchObject({ width: 10, height: 10 });
  });
});
