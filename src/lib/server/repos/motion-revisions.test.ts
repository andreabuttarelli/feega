import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { RevisionOutcome, appendRevision, listRevisions, readHead } from './motion-revisions';

type Row = Record<string, unknown>;

export function revisionsDb(seed: Row[] = []) {
  const rows: Row[] = [...seed];

  const query = () => {
    const filters: [string, unknown][] = [];
    const chain = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: hits()[0] ?? null, error: null }),
      then: (resolve: (r: { data: Row[]; error: null }) => unknown) => resolve({ data: hits(), error: null })
    };
    const hits = () => rows.filter((r) => filters.every(([c, v]) => r[c] === v)).sort((a, b) => Number(b.version) - Number(a.version));
    return chain;
  };

  const db = {
    from: () => ({
      select: query,
      insert: async (row: Row) => {
        if (rows.some((r) => r.node_id === row.node_id && r.version === row.version)) {
          return { error: { code: '23505', message: 'duplicate key' } };
        }
        rows.push(row);
        return { error: null };
      }
    })
  } as unknown as Db;

  return { db, rows };
}

const ORG = 'org-a';
const NODE = 'node-1';
const user = { kind: 'user' as const, id: 'u1' };
const agent = { kind: 'agent' as const, id: 'u1', agentKey: 'motion' };

describe('motion revisions', () => {
  it('lists every version newest first with its clip count, so a broken head can be told from a good one', async () => {
    const { db } = revisionsDb();
    const full = { ...newMotionDoc(MotionFormat.Square) };
    full.tracks = [{ ...full.tracks[0], clips: [{ ...{ id: 'c1', component: 'Title', from: 0, durationInFrames: 30, props: {}, keyframes: {} } }] } as never, full.tracks[1]];
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: full, actor: agent, summary: 'added a title' });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: newMotionDoc(MotionFormat.Square), actor: user, summary: 'Undo' });

    const listed = await listRevisions(db, { orgId: ORG, nodeId: NODE });

    expect(listed.map((r) => [r.version, r.actorKind, r.summary, r.clips])).toEqual([
      [2, 'user', 'Undo', 0],
      [1, 'agent', 'added a title', 1]
    ]);
  });

  it('no revision yet means no head', async () => {
    expect(await readHead(revisionsDb().db, { orgId: ORG, nodeId: NODE })).toBeNull();
  });

  it('the first write is version 1 and becomes the head', async () => {
    const { db } = revisionsDb();
    const write = await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor: user });
    const head = await readHead(db, { orgId: ORG, nodeId: NODE });

    expect(write.outcome).toBe(RevisionOutcome.Written);
    expect(head?.version).toBe(1);
    expect(head?.doc.width).toBe(1080);
  });

  it('a writer on a stale version gets a conflict, never a silent overwrite', async () => {
    const { db } = revisionsDb();
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor: agent });
    const stale = await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Vertical), actor: user });

    expect(stale.outcome).toBe(RevisionOutcome.Conflict);
    expect((await readHead(db, { orgId: ORG, nodeId: NODE }))?.doc.height).toBe(1080);
  });

  it('an invalid doc is refused before it reaches the table', async () => {
    const { db, rows } = revisionsDb();
    const write = await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: { fps: 30 }, actor: user });

    expect(write.outcome).toBe(RevisionOutcome.Invalid);
    expect(rows).toEqual([]);
  });

  it('records who wrote it, with the agent key', async () => {
    const { db, rows } = revisionsDb();
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor: agent, summary: 'Added a title' });

    expect(rows[0]).toMatchObject({ org_id: ORG, actor_kind: 'agent', actor_id: 'u1', agent_key: 'motion', summary: 'Added a title' });
  });

  it('reads only its own org', async () => {
    const { db } = revisionsDb([{ org_id: 'org-b', node_id: NODE, version: 1, doc: newMotionDoc(MotionFormat.Square), summary: null, actor_kind: 'user' }]);

    expect(await readHead(db, { orgId: ORG, nodeId: NODE })).toBeNull();
  });
});
