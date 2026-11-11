import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { diffDoc } from '$lib/motion/doc-ops';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';
import type { Db } from '$lib/server/db/client';
import { createMemoryDb } from '$lib/server/local/memory-db';
import { OpsOutcome, commitDoc, commitOnto, commitOps } from './frame-ops';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';

vi.mock('$lib/server/repos/canvas', async (real) => ({ ...(await real<object>()), patchNodeData: vi.fn(async () => ({ ok: true })) }));

const ORG = 'org-a';
const NODE = 'node-1';
const ana = { kind: 'user' as const, id: 'ana' };
const bo = { kind: 'user' as const, id: 'bo' };
const node = { format: MotionFormat.Landscape } as never;
const scope = { orgId: ORG, nodeId: NODE, node };

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function start(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'b' } }, 'b'));
  return doc;
}

const retext = (doc: MotionDoc, id: string, text: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, text } } : c)) }))
});

const textOf = (doc: MotionDoc | undefined, id: string) => (doc ? findClip(doc, id)?.clip.props.text : undefined);

async function seeded() {
  const store = revisionsDb();
  await appendRevision(store.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: start(), actor: ana });
  return store;
}

describe('committing ops to a frame', () => {
  it('writes on the head it was based on', async () => {
    const { db } = await seeded();
    const out = await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(start(), retext(start(), 'a', 'A')), actor: ana, summary: 'Edited' });

    expect(out).toMatchObject({ outcome: OpsOutcome.Written, rebased: false, head: { version: 2 } });
    expect(textOf((await readHead(db, scope))?.doc, 'a')).toBe('A');
  });

  it('rebases a stale edit onto the newer head instead of refusing it', async () => {
    const { db } = await seeded();
    await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(start(), retext(start(), 'b', 'B')), actor: bo, summary: 'Bo' });

    const out = await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(start(), retext(start(), 'a', 'A')), actor: ana, summary: 'Ana' });

    expect(out).toMatchObject({ outcome: OpsOutcome.Written, rebased: true, head: { version: 3 } });
    const head = await readHead(db, scope);
    expect([textOf(head?.doc, 'a'), textOf(head?.doc, 'b')]).toEqual(['A', 'B']);
  });

  it('retries when another writer lands between its read and its write', async () => {
    const { db, rows } = await seeded();
    let raced = false;
    const racing = {
      from: db.from,
      rpc: async (name: string, args: unknown) => {
        if (!raced) {
          raced = true;
          await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: retext(start(), 'b', 'B'), actor: bo });
        }
        return (db as unknown as { rpc: (n: string, a: unknown) => Promise<unknown> }).rpc(name, args);
      }
    } as unknown as Db;

    const out = await commitOps(racing, { ...scope, baseVersion: 1, ops: diffDoc(start(), retext(start(), 'a', 'A')), actor: ana, summary: 'Ana' });

    expect(out).toMatchObject({ outcome: OpsOutcome.Written, head: { version: 3 } });
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3]);
    const head = await readHead(db, scope);
    expect([textOf(head?.doc, 'a'), textOf(head?.doc, 'b')]).toEqual(['A', 'B']);
  });

  it('refuses a base the server has never written', async () => {
    const { db, rows } = await seeded();
    const out = await commitOps(db, { ...scope, baseVersion: 7, ops: [], actor: ana, summary: 'x' });

    expect(out.outcome).toBe(OpsOutcome.Invalid);
    expect(rows).toHaveLength(1);
  });

  it('refuses ops whose result is not a valid doc', async () => {
    const { db, rows } = await seeded();
    const out = await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(start(), { ...start(), durationInFrames: -1 }), actor: ana, summary: 'x' });

    expect(out.outcome).toBe(OpsOutcome.Invalid);
    expect(rows).toHaveLength(1);
  });

  it('writes nothing when the ops change nothing', async () => {
    const { db, rows } = await seeded();
    const out = await commitOps(db, { ...scope, baseVersion: 1, ops: [], actor: ana, summary: 'x' });

    expect(out).toMatchObject({ outcome: OpsOutcome.Written, head: { version: 1 } });
    expect(rows).toHaveLength(1);
  });
});

describe('committing a whole doc edited from an older head', () => {
  it('keeps the edits the editor made while the agent worked', async () => {
    const { db } = await seeded();
    await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(start(), retext(start(), 'b', 'typed by hand')), actor: ana, summary: 'Ana' });

    const out = await commitDoc(db, { ...scope, base: { version: 1, doc: start() }, doc: retext(start(), 'a', 'agent'), actor: bo, summary: 'Agent' });

    expect(out.outcome).toBe(OpsOutcome.Written);
    const head = await readHead(db, scope);
    expect([textOf(head?.doc, 'a'), textOf(head?.doc, 'b')]).toEqual(['agent', 'typed by hand']);
  });
});

describe('committing a whole doc on a current head', () => {
  it('writes without reading the head it already holds', async () => {
    const { db } = await seeded();
    const from = vi.spyOn(db, 'from');

    const out = await commitDoc(db, { ...scope, base: { version: 1, doc: start() }, doc: retext(start(), 'a', 'A'), actor: ana, summary: 'Edited' });

    expect(out).toMatchObject({ outcome: OpsOutcome.Written, rebased: false, head: { version: 2 } });
    expect(from).not.toHaveBeenCalled();
  });
});

describe('commitOnto: a whole-doc write lands as ops on whatever head is current', () => {
  it('a write based on an older version keeps the edit that landed meanwhile', async () => {
    const { db } = await seeded();
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: retext(start(), 'b', 'B'), actor: bo });

    const out = await commitOnto(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: retext(start(), 'a', 'A'), actor: ana, summary: 'Ana' });

    expect(out.outcome).toBe(RevisionOutcome.Written);
    const head = await readHead(db, scope);
    expect([textOf(head?.doc, 'a'), textOf(head?.doc, 'b')]).toEqual(['A', 'B']);
  });

  it('the first revision of a new frame is written as is', async () => {
    const { db } = revisionsDb();

    const out = await commitOnto(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: start(), actor: ana, summary: null });

    expect(out).toMatchObject({ outcome: RevisionOutcome.Written, head: { version: 1 } });
  });
});

const colour = (hex: string) => ({ type: 'colour' as const, values: { Default: hex } });
const withVars = (doc: MotionDoc, vars: Record<string, ReturnType<typeof colour>>): MotionDoc => ({ ...doc, variables: { Brand: { modes: ['Default'], vars } } });

describe('a stale save never overwrites what landed after its base', () => {
  const pulled = () => withVars(start(), { ink: colour('#111111'), 'brand-rose': colour('#ff3366'), accent: colour('#3366ff') });
  const staleEdit = () => withVars(start(), { ink: colour('#222222') });

  async function pulledOver() {
    const store = await seeded();
    await appendRevision(store.db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: withVars(start(), { ink: colour('#111111') }), actor: ana });
    await appendRevision(store.db, { orgId: ORG, nodeId: NODE, expectedVersion: 2, doc: pulled(), actor: bo });
    return store;
  }

  it('ops based on a version whose field changed since are a conflict, and the newer doc stays', async () => {
    const { db, rows } = await pulledOver();
    const base = withVars(start(), { ink: colour('#111111') });

    const out = await commitOps(db, { ...scope, baseVersion: 2, ops: diffDoc(base, staleEdit()), actor: ana, summary: 'Stale tab' });

    expect(out.outcome).toBe(OpsOutcome.Conflict);
    expect(rows).toHaveLength(3);
    expect((await readHead(db, scope))?.doc.variables).toEqual(pulled().variables);
  });

  it('a whole doc saved from that version is refused the same way', async () => {
    const { db } = await pulledOver();

    const out = await commitOnto(db, { orgId: ORG, nodeId: NODE, expectedVersion: 2, doc: staleEdit(), actor: ana, summary: 'Stale tab' });

    expect(out.outcome).toBe(RevisionOutcome.Conflict);
    expect((await readHead(db, scope))?.doc.variables).toEqual(pulled().variables);
  });

  it('a stale edit that touches nothing the newer head changed still rebases', async () => {
    const { db } = await pulledOver();
    const base = withVars(start(), { ink: colour('#111111') });

    const out = await commitOps(db, { ...scope, baseVersion: 2, ops: diffDoc(base, retext(base, 'a', 'A')), actor: ana, summary: 'Text' });

    expect(out).toMatchObject({ outcome: OpsOutcome.Written, rebased: true, head: { version: 4 } });
    const head = await readHead(db, scope);
    expect([textOf(head?.doc, 'a'), head?.doc.variables]).toEqual(['A', pulled().variables]);
  });

  it('local file mode refuses the same stale save', async () => {
    const db = createMemoryDb({ tables: new Map(), blobs: new Map(), user: { id: 'ana', email: 'a@x', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} }) as unknown as Db;
    const base = withVars(start(), { ink: colour('#111111') });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: base, actor: ana });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: pulled(), actor: bo });

    const out = await commitOps(db, { ...scope, baseVersion: 1, ops: diffDoc(base, staleEdit()), actor: ana, summary: 'Stale tab' });

    expect(out.outcome).toBe(OpsOutcome.Conflict);
    expect((await readHead(db, scope))?.doc.variables).toEqual(pulled().variables);
  });
});
