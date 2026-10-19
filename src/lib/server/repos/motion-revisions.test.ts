import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { CHECKPOINT_IDLE_MS, Checkpoint, RevisionOutcome, appendRevision, headCache, listRevisions, readCheckpoint, readHead, readRevision, sealRevision } from './motion-revisions';

type Row = Record<string, unknown>;

export function revisionsDb(seed: Row[] = [], schema: { checkpoints: boolean } = { checkpoints: true }) {
  const rows: Row[] = [...seed];

  const query = () => {
    const filters: [string, unknown][] = [];
    const floors: [string, number][] = [];
    let ascending = false;
    const chain = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return chain;
      },
      gte(column: string, value: number) {
        floors.push([column, value]);
        return chain;
      },
      order: (_column: string, options?: { ascending?: boolean }) => ((ascending = options?.ascending ?? true), chain),
      limit: () => chain,
      maybeSingle: async () => ({ data: hits()[0] ?? null, error: null }),
      then: (resolve: (r: { data: Row[]; error: null }) => unknown) => resolve({ data: hits(), error: null })
    };
    const hits = () =>
      rows
        .filter((r) => filters.every(([c, v]) => r[c] === v) && floors.every(([c, v]) => Number(r[c]) >= v))
        .sort((a, b) => (ascending ? 1 : -1) * (Number(a.version) - Number(b.version)));
    return chain;
  };

  const insert = (row: Row) => {
    if (rows.some((r) => r.node_id === row.node_id && r.version === row.version)) {
      return { code: '23505', message: 'duplicate key' };
    }
    rows.push({ created_at: new Date().toISOString(), sealed: false, ...row });
    return null;
  };

  const update = (patch: Row) => {
    const filters: [string, unknown][] = [];
    const chain = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return chain;
      },
      then: (resolve: (r: { error: null }) => unknown) => {
        rows.filter((r) => filters.every(([c, v]) => r[c] === v)).forEach((r) => Object.assign(r, patch));
        return resolve({ error: null });
      }
    };
    return chain;
  };

  const commit = (a: Record<string, unknown>) => {
    const head = rows.filter((r) => r.node_id === a.p_node_id && r.org_id === a.p_org_id).sort((x, y) => Number(y.version) - Number(x.version))[0];
    if (Number(head?.version ?? 0) !== a.p_expected) {
      return { data: null, error: null };
    }
    const version = Number(a.p_expected) + 1;
    const fields = { version, doc: a.p_doc, summary: a.p_summary, created_at: new Date().toISOString() };
    const sameActor = head && head.actor_kind === a.p_actor_kind && (head.actor_id ?? null) === a.p_actor_id && (head.agent_key ?? null) === a.p_agent_key;
    const recent = head && Date.parse(String(head.created_at)) > Date.now() - Number(a.p_coalesce_ms);
    if (Number(a.p_coalesce_ms) > 0 && sameActor && recent && !head.sealed) {
      Object.assign(head, fields);
      return { data: version, error: null };
    }
    const error = insert({ org_id: a.p_org_id, node_id: a.p_node_id, actor_kind: a.p_actor_kind, actor_id: a.p_actor_id, agent_key: a.p_agent_key, ...fields });
    return { data: error ? null : version, error: null };
  };

  const db = {
    from: () => ({
      select: query,
      insert: async (row: Row) => ({ error: insert(row) }),
      update
    }),
    rpc: async (name: string, args: Record<string, unknown>) => (schema.checkpoints && name === 'commit_motion_revision' ? commit(args) : { data: null, error: { code: 'PGRST202', message: 'no function' } })
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

describe('revisions are checkpoints, not one row per edit', () => {
  afterEach(() => vi.useRealTimers());

  const doc = (height: number) => ({ ...newMotionDoc(MotionFormat.Square), height });
  const write = (db: Db, expectedVersion: number, actor: typeof user | typeof agent, checkpoint = Checkpoint.Coalesce, height = 1080) =>
    appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion, doc: doc(height), actor, checkpoint });

  it('consecutive edits by one actor land on the head: the version moves, the rows do not', async () => {
    const { db, rows } = revisionsDb();
    await write(db, 0, user);
    await write(db, 1, user);
    const third = await write(db, 2, user, Checkpoint.Coalesce, 900);

    expect(third).toMatchObject({ outcome: RevisionOutcome.Written, head: { version: 3 } });
    expect(rows).toHaveLength(1);
    expect((await readHead(db, { orgId: ORG, nodeId: NODE }))?.doc.height).toBe(900);
  });

  it('an edit after the actor went idle cuts a new revision', async () => {
    vi.useFakeTimers();
    const { db, rows } = revisionsDb();
    await write(db, 0, user);
    vi.advanceTimersByTime(CHECKPOINT_IDLE_MS + 1);
    await write(db, 1, user);

    expect(rows.map((r) => r.version)).toEqual([1, 2]);
  });

  it('another actor never edits inside someone else\'s checkpoint', async () => {
    const { db, rows } = revisionsDb();
    await write(db, 0, user);
    await write(db, 1, agent);

    expect(rows.map((r) => [r.version, r.actor_kind])).toEqual([[1, 'user'], [2, 'agent']]);
  });

  it('a cut always writes a new revision, and the next edit does not swallow a sealed one', async () => {
    const { db, rows } = revisionsDb();
    await write(db, 0, user);
    await write(db, 1, user, Checkpoint.Cut);
    await sealRevision(db, { orgId: ORG, nodeId: NODE, version: 2 });
    await write(db, 2, user);

    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(await readRevision(db, { orgId: ORG, nodeId: NODE, version: 2 })).not.toBeNull();
  });

  it('a stale version is a conflict even when the version it names was folded away', async () => {
    const { db } = revisionsDb();
    await write(db, 0, user);
    await write(db, 1, user);

    expect((await write(db, 1, user)).outcome).toBe(RevisionOutcome.Conflict);
    expect((await write(db, 1, agent)).outcome).toBe(RevisionOutcome.Conflict);
  });

  it('before the migration lands, every edit still saves as its own revision', async () => {
    const { db, rows } = revisionsDb([], { checkpoints: false });
    await write(db, 0, user);
    await write(db, 1, user);

    expect(rows.map((r) => r.version)).toEqual([1, 2]);
    expect((await write(db, 1, user)).outcome).toBe(RevisionOutcome.Conflict);
  });

  it('a version folded into a later checkpoint reads as that checkpoint', async () => {
    const { db } = revisionsDb();
    await write(db, 0, user);
    await write(db, 1, user, Checkpoint.Coalesce, 900);

    expect(await readRevision(db, { orgId: ORG, nodeId: NODE, version: 1 })).toBeNull();
    expect(await readCheckpoint(db, { orgId: ORG, nodeId: NODE, version: 1 })).toMatchObject({ version: 2, doc: { height: 900 } });
  });
});

describe('a cached head is read without the doc while the version holds', () => {
  const docReads = (db: Db) => {
    const columns: string[] = [];
    const from = db.from.bind(db);
    (db as unknown as { from: unknown }).from = (table: string) => {
      const t = from(table as never) as unknown as { select: (c: string) => unknown };
      return { ...t, select: (c: string) => (columns.push(c), t.select(c)) };
    };
    return () => columns.filter((c) => c.includes('doc')).length;
  };

  it('reopening the same version does not download the doc again', async () => {
    const { db } = revisionsDb();
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor: user });
    const cache = headCache();
    const reads = docReads(db);

    const first = await readHead(db, { orgId: ORG, nodeId: NODE }, cache);
    const again = await readHead(db, { orgId: ORG, nodeId: NODE }, cache);

    expect(again).toEqual(first);
    expect(reads()).toBe(1);
  });

  it('a new version is read in full, never served from the cache', async () => {
    const { db } = revisionsDb();
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor: user });
    const cache = headCache();
    await readHead(db, { orgId: ORG, nodeId: NODE }, cache);
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: { ...newMotionDoc(MotionFormat.Square), height: 900 }, actor: user });

    const head = await readHead(db, { orgId: ORG, nodeId: NODE }, cache);

    expect(head).toMatchObject({ version: 2, doc: { height: 900 } });
  });

  it('a caller editing the doc it got does not change what the next reader sees', async () => {
    const { db } = revisionsDb();
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Square), actor: user });
    const cache = headCache();

    (await readHead(db, { orgId: ORG, nodeId: NODE }, cache))!.doc.height = 1;

    expect((await readHead(db, { orgId: ORG, nodeId: NODE }, cache))?.doc.height).toBe(1080);
  });
});
