import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { DataCheck, patchNodeData, writeNodeData } from './canvas';
import { appendRevision } from './motion-revisions';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import type { Db } from '$lib/server/db/client';

const ORG = 'org-1';
const NODE = 'n-1';
const MARCO = { kind: 'user' as const, id: 'u-marco' };

const nodeRow = { id: NODE, org_id: ORG, canvas_id: 'c-1', project_id: 'p-1', type: 'text', display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data: { text: 'theirs', tags: ['a', 'theirs'] }, version: 5, deleted_at: null };
const winner = { id: 41, org_id: ORG, canvas_id: 'c-1', kind: 'node.update', node_id: NODE, edge_id: null, before: {}, after: {}, actor_kind: 'agent', actor_id: 'u-anna', agent_key: 'sidebar', created_at: '2026-10-29T10:00:00Z' };

const inserted = (calls: ReturnType<typeof fakeDb>['calls']) => calls.find((c) => c.table === 'canvas_conflicts' && c.op === 'insert')?.payload;

describe('a refused write is recorded, not lost', () => {
  it('a stale version leaves the refused patch, both versions, who and the winning event', async () => {
    const { db, calls } = fakeDb({ nodes: [nodeRow], canvas_events: [winner] }, { updateRows: { nodes: [] } });

    const result = await writeNodeData(db, { orgId: ORG, nodeId: NODE, data: { text: 'mine' }, expectedVersion: 3, actor: MARCO });

    expect(result).toEqual({ outcome: 'conflict' });
    expect(inserted(calls)).toMatchObject({ org_id: ORG, canvas_id: 'c-1', node_id: NODE, expected_version: 3, actual_version: 5, attempt: 'replace', attempted: { text: 'mine' }, winning_event_id: 41, actor_kind: 'user', actor_id: 'u-marco' });
  });

  it('a patch that clashes with a newer edit is recorded as a patch', async () => {
    const { db, calls } = fakeDb({ nodes: [nodeRow], canvas_events: [winner] });

    const result = await patchNodeData(db, { orgId: ORG, nodeId: NODE, patch: { tags: ['a', 'mine'] }, base: { tags: ['a'] }, check: DataCheck.None, actor: MARCO });

    expect(result).toEqual({ outcome: 'conflict', keys: ['tags'] });
    expect(inserted(calls)).toMatchObject({ expected_version: null, actual_version: 5, attempt: 'patch', attempted: { tags: ['a', 'mine'] }, winning_event_id: 41 });
  });

  it('a frame edit on a stale head is recorded with the refused doc', async () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const fake = fakeDb({ nodes: [{ ...nodeRow, type: 'motion' }], motion_revisions: [{ org_id: ORG, node_id: NODE, version: 9, doc, summary: null, actor_kind: 'agent' }] }, { filter: true });
    const db = { ...fake.db, rpc: async () => ({ data: null, error: null }) } as unknown as Db;

    const result = await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 7, doc, actor: MARCO });

    expect(result.outcome).toBe('conflict');
    expect(inserted(fake.calls)).toMatchObject({ canvas_id: 'c-1', node_id: NODE, expected_version: 7, actual_version: 9, attempt: 'motion_head', winning_event_id: null, actor_id: 'u-marco' });
  });
});
