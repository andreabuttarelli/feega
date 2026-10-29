import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { createMemoryDb } from '$lib/server/local/memory-db';
import { createNode, findNode, patchNodeData, DataCheck } from '$lib/server/repos/canvas';
import { listCanvasEvents } from '$lib/server/repos/canvas-events';
import type { Actor } from '$lib/server/repos/actor';
import { Keep } from '$lib/canvas/reject-plan';
import { HistoryFilter } from '$lib/canvas/history/timeline';
import { readHistory } from './history';
import { RevertRefusal, revertChange } from './revert';

const ORG = 'org';
const CANVAS = 'canvas';
const MARCO: Actor = { kind: 'user', id: 'u1' };
const ANNA: Actor = { kind: 'user', id: 'u2' };
const CLAUDE: Actor = { kind: 'agent', id: 'u1', agentKey: 'claude-code', sessionId: '6f1c2a9e-1b7d-4c3e-9a51-2f0e8d7c6b5a' };

function memory(): Db {
  return createMemoryDb({
    tables: new Map(),
    blobs: new Map(),
    user: { id: 'u1', email: 'a@b.c', created_at: '2026-01-01' },
    storageUrl: () => '',
    onChange: () => {}
  }) as unknown as Db;
}

const make = (db: Db, data: Record<string, unknown>, actor = MARCO) => createNode(db, { orgId: ORG, projectId: 'p', canvasId: CANVAS, type: 'text', x: 0, y: 0, data, actor });

const patch = (db: Db, nodeId: string, data: Record<string, unknown>, actor: Actor) => patchNodeData(db, { orgId: ORG, nodeId, patch: data, check: DataCheck.None, actor });

const lastEventId = async (db: Db) => (await listCanvasEvents(db, { orgId: ORG, canvasId: CANVAS, limit: 1 }))[0].id;

const revert = (db: Db, entryId: string, extra: Partial<Parameters<typeof revertChange>[1]> = {}) => revertChange(db, { orgId: ORG, canvasId: CANVAS, entryId, actor: ANNA, ...extra });

const dataOf = async (db: Db, nodeId: string) => (await findNode(db, { orgId: ORG, nodeId }))!.data;

describe('revert any change on the timeline, whoever made it', () => {
  it('a change a person made goes back when nothing later touched it', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'first' });
    await patch(db, node.id, { prompt: 'second' }, MARCO);

    const result = await revert(db, `event:${await lastEventId(db)}`);

    expect(result.outcome).toBe('rejected');
    expect(await dataOf(db, node.id)).toEqual({ prompt: 'first' });
  });

  it('the revert is a change on the reverter lane, and can itself be reverted', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'first' });
    await patch(db, node.id, { prompt: 'second' }, MARCO);
    await revert(db, `event:${await lastEventId(db)}`);
    const [written] = await listCanvasEvents(db, { orgId: ORG, canvasId: CANVAS, limit: 1 });

    expect(written).toMatchObject({ actorKind: 'user', actorId: 'u2' });

    await revert(db, `event:${written.id}`);
    expect(await dataOf(db, node.id)).toEqual({ prompt: 'second' });
  });

  it('a whole agent session goes back in one revert', async () => {
    const db = memory();
    const a = await make(db, { prompt: 'a' });
    const b = await make(db, { prompt: 'b' });
    await patch(db, a.id, { prompt: 'a by claude' }, CLAUDE);
    await patch(db, b.id, { prompt: 'b by claude' }, CLAUDE);
    const graph = await readHistory(db, { orgId: ORG, canvasId: CANVAS, filter: HistoryFilter.Ai });

    const result = await revert(db, graph.sessions[0].key);

    expect(result.outcome).toBe('rejected');
    expect([await dataOf(db, a.id), await dataOf(db, b.id)]).toEqual([{ prompt: 'a' }, { prompt: 'b' }]);
  });

  it('a field edited since is a choice per field, and one choice by path answers it', async () => {
    const db = memory();
    const node = await make(db, { prompt: 'first' });
    await patch(db, node.id, { prompt: 'claude' }, CLAUDE);
    const change = `event:${await lastEventId(db)}`;
    await patch(db, node.id, { prompt: 'marco' }, MARCO);

    expect(await revert(db, change)).toMatchObject({ outcome: 'conflict', conflicts: [{ path: 'data.prompt', mine: 'marco', original: 'first' }] });

    await revert(db, change, { choices: [{ path: 'data.prompt', keep: Keep.Reject }] });
    expect(await dataOf(db, node.id)).toEqual({ prompt: 'first' });
  });

  it('a named version is restored, not reverted, and an unknown change is not found', async () => {
    const db = memory();

    expect(await revert(db, 'version:v-1')).toEqual({ outcome: RevertRefusal.NotRevertable });
    expect(await revert(db, 'event:999')).toEqual({ outcome: 'not_found' });
    expect(await revert(db, 'nonsense')).toEqual({ outcome: 'not_found' });
  });
});
