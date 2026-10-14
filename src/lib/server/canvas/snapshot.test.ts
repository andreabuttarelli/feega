import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { canvasSnapshot } from './snapshot';
import { recordsRevision } from './revision';

const ORG = '11111111-1111-1111-1111-111111111111';
const CANVAS = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';
const PRODUCTS = '33333333-3333-3333-3333-333333333334';

const nodeRow = (id: string, type: string) => ({
  id,
  org_id: ORG,
  project_id: 'p',
  canvas_id: CANVAS,
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: {},
  version: 1,
  deleted_at: null
});

describe('canvasSnapshot', () => {
  it('reads the nodes, their lines, runs and downloaded content, with the revision they make', async () => {
    const { db } = fakeDb(
      { nodes: [nodeRow(NODE, 'text'), nodeRow(PRODUCTS, 'products')], nodes_connections: [], node_runs: [], products: [], social_posts: [] },
      { filter: true }
    );

    const snap = await canvasSnapshot(db, { orgId: ORG, canvasId: CANVAS });

    expect(snap.nodes.map((n) => n.id)).toEqual([NODE, PRODUCTS]);
    expect(Object.keys(snap.runs).sort()).toEqual([NODE, PRODUCTS].sort());
    expect(Object.keys(snap.products)).toEqual([PRODUCTS]);
    expect(snap.socialPosts).toEqual({});
    expect(snap.influencers).toEqual({});
    expect(snap.revision).toBe(recordsRevision(snap.nodes, snap.connections));
  });
});
