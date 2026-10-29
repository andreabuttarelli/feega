import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { HistoryAction } from '$lib/canvas/history/timeline';
import { HistoryOutcome, actAt, previewAt } from './history-actions';

const ORG = 'org-1';
const CANVAS = 'c-1';
const FRAME = 'frame-1';
const scope = { orgId: ORG, canvasId: CANVAS };
const user = { kind: 'user' as const, id: 'u-1' };

const node = (id: string, type: string, x = 0, data: Record<string, unknown> = {}) => ({ id, org_id: ORG, canvas_id: CANVAS, project_id: 'p-1', type, display_name: null, x, y: 0, z: 0, width: 100, height: 50, data, version: 1, deleted_at: null });

const revision = (version: number, durationInFrames: number) => ({ org_id: ORG, node_id: FRAME, version, doc: { ...newMotionDoc(MotionFormat.Landscape), durationInFrames }, summary: `v${version}`, actor_kind: 'user', actor_id: 'u-1', agent_key: null, created_at: `2026-10-29T1${version}:00:00Z`, checkpoint: true });

const snapshot = { nodes: [{ id: 'a', type: 'text', position: { x: 10, y: 0, z: 0 }, size: { width: 100, height: 50 }, data: { prompt: 'a' } }], connections: [], heads: {} };

const rows = () => ({
  nodes: [node('a', 'text', 99), node('b', 'text'), node(FRAME, 'motion', 0, { format: '16:9', docHeadRevision: 3, posterAssetId: null, lastRenderAssetId: null })],
  nodes_connections: [],
  canvas_events: [],
  canvas_versions: [{ id: 'v1', org_id: ORG, canvas_id: CANVAS, name: 'Start', created_at: '2026-10-18', snapshot }],
  motion_revisions: [revision(2, 300), revision(3, 600)]
});

describe('Preview shows the canvas at a point, read-only', () => {
  it('a saved version shows the nodes it held', async () => {
    const { db, calls } = fakeDb(rows(), { filter: true, store: true });

    const out = await previewAt(db, { ...scope, entryId: 'version:v1' });

    expect(out).toMatchObject({ outcome: HistoryOutcome.Done, preview: { nodes: [{ id: 'a', type: 'text' }], connections: 0 } });
    expect(calls.some((c) => c.op !== 'select')).toBe(false);
  });

  it('a frame revision shows that frame as it was', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    const out = await previewAt(db, { ...scope, entryId: `revision:${FRAME}:2` });

    expect(out).toMatchObject({ outcome: HistoryOutcome.Done, preview: { frameId: FRAME, version: 2, summary: 'v2', clips: 0, seconds: 10 } });
  });

  it('a structural event is not a point to preview', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    expect((await previewAt(db, { ...scope, entryId: 'event:7' })).outcome).toBe(HistoryOutcome.Unsupported);
  });
});

describe('Restore to here never destroys the present', () => {
  it('a saved version comes back, and the moment before is saved first', async () => {
    const fake = fakeDb(rows(), { filter: true, store: true });

    const out = await actAt(fake.db, { action: HistoryAction.Restore,  ...scope, entryId: 'version:v1', actor: user });

    expect(out.outcome).toBe(HistoryOutcome.Done);
    expect(fake.calls.filter((c) => c.table === 'canvas_versions' && c.op === 'insert').map((c) => (c.payload as { name: string }).name)).toEqual(['Before restoring Start']);
  });

  it('a frame revision of another canvas is missing, not restored', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    expect((await actAt(db, { action: HistoryAction.Restore,  orgId: ORG, canvasId: 'elsewhere', entryId: `revision:${FRAME}:2`, actor: user })).outcome).toBe(HistoryOutcome.Missing);
  });

  it('an unknown version is missing', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    expect((await actAt(db, { action: HistoryAction.Restore,  ...scope, entryId: 'version:nope', actor: user })).outcome).toBe(HistoryOutcome.Missing);
  });
});

describe('Name this version', () => {
  it('names a frame revision', async () => {
    const fake = fakeDb(rows(), { filter: true, store: true });

    const out = await actAt(fake.db, { action: HistoryAction.Name,  ...scope, entryId: `revision:${FRAME}:2`, name: 'Client review', actor: user });

    expect(out.outcome).toBe(HistoryOutcome.Done);
    const patch = fake.calls.find((c) => c.table === 'nodes' && c.op === 'update');
    expect(JSON.stringify(patch?.payload)).toContain('Client review');
  });

  it('a saved version already has its name', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    expect((await actAt(db, { action: HistoryAction.Name,  ...scope, entryId: 'version:v1', name: 'x', actor: user })).outcome).toBe(HistoryOutcome.Unsupported);
  });
});

describe('a branch merges back or is dropped from History', () => {
  const BRANCH = 'branch-1';
  const branched = () => {
    const base = rows();
    return {
      ...base,
      nodes: [...base.nodes, node(BRANCH, 'motion', 0, { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, branchOf: { nodeId: FRAME, baseVersion: 3, name: 'Bolder' } })],
      motion_revisions: [...base.motion_revisions, { ...revision(1, 300), node_id: BRANCH }]
    };
  };

  it('Drop removes the branch node', async () => {
    const fake = fakeDb(branched(), { filter: true, store: true });

    expect((await actAt(fake.db, { ...scope, entryId: `branch:${BRANCH}:1`, action: HistoryAction.Drop, actor: user })).outcome).toBe(HistoryOutcome.Done);
    expect(fake.calls.some((c) => c.table === 'nodes' && c.op === 'update' && JSON.stringify(c.payload).includes('deleted_at'))).toBe(true);
  });

  it('Merge writes the branch into the frame', async () => {
    const fake = fakeDb(branched(), { filter: true, store: true });

    expect((await actAt(fake.db, { ...scope, entryId: `branch:${BRANCH}:1`, action: HistoryAction.Merge, actor: user })).outcome).toBe(HistoryOutcome.Done);
  });

  it('a branch is not restored or named', async () => {
    const { db } = fakeDb(branched(), { filter: true });

    expect((await actAt(db, { ...scope, entryId: `branch:${BRANCH}:1`, action: HistoryAction.Restore, actor: user })).outcome).toBe(HistoryOutcome.Unsupported);
  });
});

describe('a conflict entry is resolved elsewhere, not from History', () => {
  it('has nothing to preview', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    expect((await previewAt(db, { ...scope, entryId: 'conflict:c1' })).outcome).toBe(HistoryOutcome.Unsupported);
  });

  it('has no action to run', async () => {
    const { db } = fakeDb(rows(), { filter: true });

    expect((await actAt(db, { ...scope, entryId: 'conflict:c1', action: HistoryAction.Restore, actor: user })).outcome).toBe(HistoryOutcome.Unsupported);
  });
});
