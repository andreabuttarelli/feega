import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { RestoreOutcome, listCanvasVersions, restoreCanvasVersion, saveCanvasVersion } from './canvas-versions';

const scope = { orgId: 'org', canvasId: 'c' };
const user = { kind: 'user' as const, id: 'u' };
const row = (id: string, x: number) => ({ id, org_id: 'org', canvas_id: 'c', project_id: 'p', type: 'text', display_name: null, x, y: 0, z: 0, width: 100, height: 50, data: { prompt: id }, version: 1, deleted_at: null });

describe('canvas versions', () => {
  it('saves every node and connection under a name, and lists it', async () => {
    const fake = fakeDb({ nodes: [row('a', 10)], nodes_connections: [], motion_revisions: [], canvas_versions: [] }, { filter: true, store: true });

    const saved = await saveCanvasVersion(fake.db, { ...scope, name: ' Client review ', actor: user });

    expect(saved).toMatchObject({ name: 'Client review', nodes: 1 });
    const insert = fake.calls.find((c) => c.table === 'canvas_versions' && c.op === 'insert');
    expect((insert?.payload as { snapshot: { nodes: { id: string; position: { x: number } }[] } }).snapshot.nodes).toMatchObject([{ id: 'a', position: { x: 10 } }]);
    expect((await listCanvasVersions(fake.db, scope)).map((v) => v.name)).toContain('Client review');
  });

  it('restores by moving nodes back and removing the ones added since, keeping a version of the moment before', async () => {
    const snapshot = { nodes: [{ id: 'a', type: 'text', position: { x: 10, y: 0, z: 0 }, size: { width: 100, height: 50 }, data: { prompt: 'a' } }], connections: [], heads: {} };
    const fake = fakeDb(
      { nodes: [row('a', 99), row('b', 0)], nodes_connections: [], motion_revisions: [], canvas_events: [], canvas_versions: [{ id: 'v1', org_id: 'org', canvas_id: 'c', name: 'Start', created_at: '2026-10-18', snapshot }] },
      { filter: true, store: true }
    );

    expect(await restoreCanvasVersion(fake.db, { ...scope, versionId: 'v1', actor: user })).toMatchObject({ outcome: RestoreOutcome.Restored, changed: 2 });

    const updates = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'update');
    expect(updates.some((u) => (u.payload as { x?: number }).x === 10)).toBe(true);
    expect(updates.some((u) => (u.payload as { deleted_at?: string }).deleted_at && u.filters.some(([k, v]) => k === 'id' && v === 'b'))).toBe(true);
    expect(fake.calls.filter((c) => c.table === 'canvas_versions' && c.op === 'insert').map((c) => (c.payload as { name: string }).name)).toEqual(['Before restoring Start']);
  });

  it('a version that is not there is refused', async () => {
    const fake = fakeDb({ canvas_versions: [] }, { filter: true });
    expect((await restoreCanvasVersion(fake.db, { ...scope, versionId: 'nope', actor: user })).outcome).toBe(RestoreOutcome.Missing);
  });
});
