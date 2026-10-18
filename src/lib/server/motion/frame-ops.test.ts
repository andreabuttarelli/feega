import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { diffDoc } from '$lib/motion/doc-ops';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';
import type { Db } from '$lib/server/db/client';
import { OpsOutcome, commitDoc, commitOps } from './frame-ops';

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
      from: (table: string) => {
        const real = db.from(table as never) as unknown as { insert: (row: unknown) => Promise<unknown> };
        return {
          ...real,
          insert: async (row: unknown) => {
            if (!raced) {
              raced = true;
              await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: retext(start(), 'b', 'B'), actor: bo });
            }
            return real.insert(row);
          }
        };
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
    expect(from).toHaveBeenCalledTimes(1);
  });
});
