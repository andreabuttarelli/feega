import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { createMemoryDb } from '$lib/server/local/memory-db';
import { createConnection, createNode, deleteNode, findNode, moveNode, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { listCanvasEvents } from '$lib/server/repos/canvas-events';
import type { Actor } from '$lib/server/repos/actor';
import { Keep } from '$lib/canvas/reject-plan';
import { undoGesture } from './undo';
import { rejectChange } from './reject';

const ORG = 'org';
const CANVAS = 'canvas';
const USER: Actor = { kind: 'user', id: 'u1' };
const AGENT: Actor = { kind: 'agent', id: 'u1', agentKey: 'mcp' };

function memory(): Db {
  return createMemoryDb({
    tables: new Map(),
    blobs: new Map(),
    user: { id: 'u1', email: 'a@b.c', created_at: '2026-01-01' },
    storageUrl: () => '',
    onChange: () => {}
  }) as unknown as Db;
}

const make = (db: Db, data: Record<string, unknown>, actor = USER) =>
  createNode(db, { orgId: ORG, projectId: 'p', canvasId: CANVAS, type: 'text', x: 0, y: 0, data, actor });

const patch = (db: Db, nodeId: string, data: Record<string, unknown>, actor: Actor) =>
  patchNodeData(db, { orgId: ORG, nodeId, patch: data, check: DataCheck.None, actor });

const lastEventId = async (db: Db) => (await listCanvasEvents(db, { orgId: ORG, canvasId: CANVAS, limit: 1 }))[0].id;

const reject = (db: Db, eventIds: number[], extra: Partial<Parameters<typeof rejectChange>[1]> = {}) =>
  rejectChange(db, { orgId: ORG, canvasId: CANVAS, eventIds, actor: USER, ...extra });

describe('reject one agent change, keep the edits made after it', () => {
  it('reverts only the agent field; the user field on the same node and another node stay', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'mine', model: 'm1' });
    const other = await make(db, { prompt: 'other' });
    await patch(db, node.id, { prompt: 'agent' }, AGENT);
    const agentEvent = await lastEventId(db);
    await patch(db, node.id, { model: 'm2' }, USER);
    await patch(db, other.id, { prompt: 'other edited' }, USER);

    const result = await reject(db, [agentEvent]);

    expect(result.outcome).toBe('rejected');
    expect((await findNode(db, { orgId: ORG, nodeId: node.id }))!.data).toEqual({ prompt: 'mine', model: 'm2' });
    expect((await findNode(db, { orgId: ORG, nodeId: other.id }))!.data).toEqual({ prompt: 'other edited' });
    const [written] = await listCanvasEvents(db, { orgId: ORG, canvasId: CANVAS, limit: 1 });
    expect(written).toMatchObject({ kind: 'node.update', actorKind: 'user', nodeId: node.id });
  });

  it('the same field edited later is a conflict, nothing written until the user chooses', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'mine' });
    await patch(db, node.id, { prompt: 'agent' }, AGENT);
    const agentEvent = await lastEventId(db);
    await patch(db, node.id, { prompt: 'mine again' }, USER);

    const asked = await reject(db, [agentEvent]);
    expect(asked).toMatchObject({ outcome: 'conflict', conflicts: [{ eventId: agentEvent, nodeId: node.id, path: 'data.prompt', mine: 'mine again', agent: 'agent', original: 'mine' }] });
    expect((await findNode(db, { orgId: ORG, nodeId: node.id }))!.data).toEqual({ prompt: 'mine again' });

    await reject(db, [agentEvent], { choices: [{ eventId: agentEvent, path: 'data.prompt', keep: Keep.Reject }] });
    expect((await findNode(db, { orgId: ORG, nodeId: node.id }))!.data).toEqual({ prompt: 'mine' });
  });

  it('a move the agent made goes back', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'x' });
    await moveNode(db, { orgId: ORG, nodeId: node.id, x: 300, y: 40, actor: AGENT });

    await reject(db, [await lastEventId(db)]);

    expect((await findNode(db, { orgId: ORG, nodeId: node.id }))!.position).toMatchObject({ x: 0, y: 0 });
  });

  it('a node the agent created is deleted, unless someone else connected it: then it asks', async () => {
    const db = memory();
    const created = await make(db, { prompt: 'agent' }, AGENT);
    const createEvent = await lastEventId(db);
    const mine = await make(db, { prompt: 'mine' });
    await createConnection(db, { orgId: ORG, canvasId: CANVAS, sourceNodeId: created.id, targetNodeId: mine.id, actor: USER });

    expect(await reject(db, [createEvent])).toMatchObject({ outcome: 'confirm', nodeId: created.id });
    expect(await findNode(db, { orgId: ORG, nodeId: created.id })).not.toBeNull();

    expect((await reject(db, [createEvent], { confirm: true })).outcome).toBe('rejected');
    expect(await findNode(db, { orgId: ORG, nodeId: created.id })).toBeNull();
  });

  it('a node the agent deleted comes back', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'keep me' });
    await deleteNode(db, { orgId: ORG, nodeId: node.id, actor: AGENT });

    await reject(db, [await lastEventId(db)]);

    expect((await findNode(db, { orgId: ORG, nodeId: node.id }))!.data).toEqual({ prompt: 'keep me' });
  });

  it('the reject is itself undoable: its undo brings the agent change back', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'mine', model: 'm1' });
    await patch(db, node.id, { prompt: 'agent' }, AGENT);
    const agentEvent = await lastEventId(db);
    await patch(db, node.id, { model: 'm2' }, USER);

    const result = await reject(db, [agentEvent]);
    if (result.outcome !== 'rejected') {
      throw new Error(result.outcome);
    }
    await undoGesture(db, { orgId: ORG, canvasId: CANVAS, gesture: { items: result.undo }, actor: USER });

    expect((await findNode(db, { orgId: ORG, nodeId: node.id }))!.data).toEqual({ prompt: 'agent', model: 'm2' });
  });

  it('an unknown event id is not found', async () => {
    expect((await reject(memory(), [999])).outcome).toBe('not_found');
  });
});
