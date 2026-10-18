import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { nameVersion, namedRevisions } from './version-names';

const scope = { orgId: 'org', nodeId: 'n' };
const user = { kind: 'user' as const, id: 'u' };

function frame(versionNames: Record<string, string> = {}) {
  return fakeDb({
    nodes: [{ id: 'n', org_id: 'org', canvas_id: 'c', project_id: 'p', type: 'motion', display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data: { format: '16:9', docHeadRevision: 2, posterAssetId: null, lastRenderAssetId: null, versionNames }, version: 1, deleted_at: null }],
    motion_revisions: [
      { org_id: 'org', node_id: 'n', version: 1, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actor_kind: 'user', created_at: '2026-10-18T10:00:00Z' },
      { org_id: 'org', node_id: 'n', version: 2, doc: newMotionDoc(MotionFormat.Landscape), summary: 'Moved', actor_kind: 'user', created_at: '2026-10-18T10:01:00Z' }
    ]
  }, { filter: true });
}

describe('naming a frame version', () => {
  it('stores the name on the frame and shows it in the version list', async () => {
    const fake = frame();

    expect(await nameVersion(fake.db, { ...scope, version: 1, name: 'Client review', actor: user })).toEqual({ named: true });

    const update = fake.calls.find((c) => c.table === 'nodes' && c.op === 'update');
    expect((update?.payload as { data: { versionNames: unknown } }).data.versionNames).toEqual({ '1': 'Client review' });
  });

  it('a named version is sealed: later edits never fold into it', async () => {
    const fake = frame();
    await nameVersion(fake.db, { ...scope, version: 2, name: 'Client review', actor: user });

    const seal = fake.calls.find((c) => c.table === 'motion_revisions' && c.op === 'update');
    expect(seal?.payload).toEqual({ sealed: true });
  });

  it('lists every version with its name, if it has one', async () => {
    const listed = await namedRevisions(frame({ '1': 'First cut' }).db, scope);
    expect(listed.map((r) => [r.version, r.name]).sort()).toEqual([
      [1, 'First cut'],
      [2, null]
    ]);
  });

  it('refuses a version that does not exist', async () => {
    expect(await nameVersion(frame().db, { ...scope, version: 9, name: 'x', actor: user })).toEqual({ named: false, error: 'no_such_version' });
  });
});
