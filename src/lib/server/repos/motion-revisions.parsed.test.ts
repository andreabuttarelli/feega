import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { readHeads, warmHeads } from './motion-revisions';

const NODE = '00000000-0000-4000-8000-0000000000a1';
const row = (version: number) => ({ org_id: 'org-a', node_id: NODE, version, doc: { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: version }, summary: null, actor_kind: 'user' });

describe('a revision read twice', () => {
  it('is fetched and validated once: a revision never changes', async () => {
    const { db, calls } = fakeDb({ motion_revisions: [row(4)] }, { filter: true });

    const first = await readHeads(db, { orgId: 'org-a', heads: [{ nodeId: NODE, version: 4 }] });
    const again = await readHeads(db, { orgId: 'org-a', heads: [{ nodeId: NODE, version: 4 }] });

    expect(again.get(NODE)!.doc).toBe(first.get(NODE)!.doc);
    expect(calls.filter((c) => c.table === 'motion_revisions')).toHaveLength(1);
  });

  it('is read again for another org, whose rows it cannot share', async () => {
    const { db } = fakeDb({ motion_revisions: [row(5), { ...row(5), org_id: 'org-b' }] }, { filter: true });

    const a = await readHeads(db, { orgId: 'org-a', heads: [{ nodeId: NODE, version: 5 }] });
    const b = await readHeads(db, { orgId: 'org-b', heads: [{ nodeId: NODE, version: 5 }] });

    expect(b.get(NODE)!.doc).not.toBe(a.get(NODE)!.doc);
  });
});

describe('a canvas warmed before anyone opens it', () => {
  it('answers every frame from memory, more frames than the default cache holds', async () => {
    const frames = Array.from({ length: 40 }, (_, i) => ({ ...row(1), org_id: 'org-w', node_id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}` }));
    const { db, calls } = fakeDb({ motion_revisions: frames }, { filter: true });
    const heads = frames.map((f) => ({ nodeId: f.node_id, version: 1 }));

    await warmHeads(db, { orgId: 'org-w', heads });
    const before = calls.length;
    const read = await readHeads(db, { orgId: 'org-w', heads });

    expect(read.size).toBe(40);
    expect(calls.length).toBe(before);
  });
});
