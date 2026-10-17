import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import type { Db } from '$lib/server/db/client';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';
import { Restore, restoreRevision } from './restore';

vi.mock('$lib/server/repos/canvas', async (real) => ({ ...(await real<object>()), patchNodeData: vi.fn(async () => ({ ok: true })) }));

const ORG = 'org-a';
const NODE = 'node-1';
const user = { kind: 'user' as const, id: 'u1' };
const node = { format: MotionFormat.Landscape } as never;

describe('restoring a motion revision', () => {
  it('writes the old doc as a new head and keeps every version', async () => {
    const { db, rows } = revisionsDb();
    const good = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 600 };
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: good, actor: user });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: newMotionDoc(MotionFormat.Landscape), actor: user, summary: 'Undo' });

    const out = await restoreRevision(db, { orgId: ORG, nodeId: NODE, node, version: 1, actor: user });

    expect(out).toMatchObject({ outcome: Restore.Restored, head: { version: 3 } });
    expect((await readHead(db, { orgId: ORG, nodeId: NODE }))?.doc.durationInFrames).toBe(600);
    expect(rows.map((r) => r.summary)).toEqual([null, 'Undo', 'Restored version 1']);
  });

  it('a version that does not exist is refused and nothing is written', async () => {
    const { db, rows } = revisionsDb();

    expect((await restoreRevision(db, { orgId: ORG, nodeId: NODE, node, version: 9, actor: user })).outcome).toBe(Restore.Missing);
    expect(rows).toEqual([]);
  });

  it('a peer edit landing while it restores is kept, not refused', async () => {
    const { db } = revisionsDb();
    const good = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 600 };
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: good, actor: user });
    await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 1, doc: newMotionDoc(MotionFormat.Landscape), actor: user });
    let raced = false;
    const racing = {
      from: (table: string) => {
        const real = db.from(table as never) as unknown as { insert: (row: unknown) => Promise<unknown> };
        return {
          ...real,
          insert: async (row: unknown) => {
            if (!raced) {
              raced = true;
              await appendRevision(db, { orgId: ORG, nodeId: NODE, expectedVersion: 2, doc: { ...newMotionDoc(MotionFormat.Landscape), fps: 24 }, actor: user });
            }
            return real.insert(row);
          }
        };
      }
    } as unknown as Db;

    const out = await restoreRevision(racing, { orgId: ORG, nodeId: NODE, node, version: 1, actor: user });

    expect(out.outcome).toBe(Restore.Restored);
    const head = await readHead(db, { orgId: ORG, nodeId: NODE });
    expect([head?.doc.durationInFrames, head?.doc.fps]).toEqual([600, 24]);
  });
});
