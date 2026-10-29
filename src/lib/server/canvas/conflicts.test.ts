import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { Resolution } from '$lib/server/repos/canvas-conflicts';
import { ResolveOutcome, resolveConflict } from './conflicts';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';

const ORG = 'org-1';
const NODE = 'n-1';
const ME = { kind: 'user' as const, id: 'u-marco' };

const node = { id: NODE, org_id: ORG, canvas_id: 'c-1', project_id: 'p-1', type: 'text', display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data: { prompt: 'theirs', model: 'm-1' }, version: 7, deleted_at: null };

const conflict = (attempt: string, attempted: Record<string, unknown>) => ({
  id: 'k-1', org_id: ORG, canvas_id: 'c-1', node_id: NODE, expected_version: 3, actual_version: 5, attempt, attempted, winning_event_id: 41,
  actor_kind: 'user', actor_id: 'u-marco', agent_key: null, resolution: null, resolved_at: null, created_at: '2026-10-29T10:00:00Z'
});

const writesTo = (calls: ReturnType<typeof fakeDb>['calls'], table: string) => calls.filter((c) => c.table === table && c.op === 'update').map((c) => c.payload);

describe('resolveConflict', () => {
  it('keep mine re-applies the refused write on the current version, then closes the row', async () => {
    const { db, calls } = fakeDb({ nodes: [node], canvas_conflicts: [conflict('replace', { text: 'mine' })] }, { filter: true });

    const out = await resolveConflict(db, { orgId: ORG, canvasId: 'c-1', conflictId: 'k-1', resolution: Resolution.Mine, actor: ME });

    expect(out.outcome).toBe(ResolveOutcome.Resolved);
    expect(writesTo(calls, 'nodes')[0]).toMatchObject({ data: { text: 'mine' }, version: 8 });
    expect(writesTo(calls, 'canvas_conflicts')[0]).toMatchObject({ resolution: 'mine' });
  });

  it('keep mine on a refused patch merges it into what is there now', async () => {
    const { db, calls } = fakeDb({ nodes: [node], canvas_conflicts: [conflict('patch', { prompt: 'mine' })] }, { filter: true });

    await resolveConflict(db, { orgId: ORG, canvasId: 'c-1', conflictId: 'k-1', resolution: Resolution.Mine, actor: ME });

    expect(writesTo(calls, 'nodes')[0]).toMatchObject({ data: { prompt: 'mine', model: 'm-1' } });
  });

  it('keep mine on a refused frame edit commits the doc on the current head', async () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const { db, calls } = fakeDb({ nodes: [node], motion_revisions: [{ org_id: ORG, node_id: NODE, version: 9, doc, summary: null, actor_kind: 'agent' }], canvas_conflicts: [conflict('motion_head', { doc })] }, { filter: true });

    const out = await resolveConflict(db, { orgId: ORG, canvasId: 'c-1', conflictId: 'k-1', resolution: Resolution.Mine, actor: ME });

    expect(out.outcome).toBe(ResolveOutcome.Resolved);
    expect(calls.find((c) => c.table === 'motion_revisions' && c.op === 'insert')?.payload).toMatchObject({ node_id: NODE, version: 10 });
  });

  it('keep theirs only closes the row', async () => {
    const { db, calls } = fakeDb({ nodes: [node], canvas_conflicts: [conflict('replace', { text: 'mine' })] }, { filter: true });

    const out = await resolveConflict(db, { orgId: ORG, canvasId: 'c-1', conflictId: 'k-1', resolution: Resolution.Theirs, actor: ME });

    expect(out.outcome).toBe(ResolveOutcome.Resolved);
    expect(writesTo(calls, 'nodes')).toEqual([]);
    expect(writesTo(calls, 'canvas_conflicts')[0]).toMatchObject({ resolution: 'theirs' });
  });

  it('a conflict already closed is not resolved twice', async () => {
    const closed = { ...conflict('replace', { text: 'mine' }), resolution: 'theirs', resolved_at: '2026-10-29T11:00:00Z' };
    const { db, calls } = fakeDb({ nodes: [node], canvas_conflicts: [closed] }, { filter: true });

    const out = await resolveConflict(db, { orgId: ORG, canvasId: 'c-1', conflictId: 'k-1', resolution: Resolution.Mine, actor: ME });

    expect(out.outcome).toBe(ResolveOutcome.AlreadyResolved);
    expect(writesTo(calls, 'nodes')).toEqual([]);
  });

  it('an unknown conflict is not found', async () => {
    const { db } = fakeDb({ nodes: [node], canvas_conflicts: [] }, { filter: true });

    const out = await resolveConflict(db, { orgId: ORG, canvasId: 'c-1', conflictId: 'k-1', resolution: Resolution.Mine, actor: ME });

    expect(out.outcome).toBe(ResolveOutcome.NotFound);
  });
});
