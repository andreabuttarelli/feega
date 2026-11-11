import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { readHeads } from './motion-revisions';

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
