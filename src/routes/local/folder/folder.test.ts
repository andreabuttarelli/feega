import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keep, Relation } from '@feega/canvas-folder';
import { createNode, listNodes } from '$lib/server/repos/canvas';
import { LOCAL_ORG_ID, openFeegaStore, type FeegaStore } from '$lib/server/local/feega-store';

const held: { store: FeegaStore | null } = { store: null };

vi.mock('$lib/server/local/local-mode', () => ({ localStore: () => held.store }));

const { GET, POST } = await import('./+server');

const ORIGIN = 'http://127.0.0.1:5173';
const OK = 200;
const NOT_FOUND = 404;

async function divergedFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'feega-route-'));
  const first = openFeegaStore(dir, { origin: ORIGIN });
  const scope = { orgId: LOCAL_ORG_ID, projectId: first.place.projectId, canvasId: first.place.canvasId };
  const node = await createNode(first.db, { ...scope, type: 'text', x: 0, y: 0, data: { text: 'base' } });
  await first.flush();

  const path = join(dir, '.feega', 'nodes', `${node.id}.json`);
  const onDisk = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...onDisk, data: { text: 'theirs' } }));
  await first.db.from('nodes').update({ data: { text: 'mine' } as never }).eq('id', node.id);
  await first.flush();

  return { store: openFeegaStore(dir, { origin: ORIGIN }), scope, nodeId: node.id };
}

const post = (body: unknown) => POST({ request: new Request(`${ORIGIN}/local/folder`, { method: 'POST', body: JSON.stringify(body) }) } as never);

describe('/local/folder', () => {
  it('answers 404 outside local mode', async () => {
    held.store = null;

    await expect(GET()).rejects.toMatchObject({ status: NOT_FOUND });
  });

  it('lists the conflicts of a diverged folder', async () => {
    const { store, nodeId } = await divergedFolder();
    held.store = store;

    const response = await GET();
    const status = await response.json();

    expect(response.status).toBe(OK);
    expect(status).toMatchObject({ relation: Relation.Diverged, conflicts: [{ id: nodeId, field: 'data.text', ours: 'mine', theirs: 'theirs' }] });
  });

  it('keeps theirs on request and answers the closed list', async () => {
    const { store, scope, nodeId } = await divergedFolder();
    held.store = store;
    const [conflict] = store.folderStatus()!.conflicts;

    const status = await (await post({ conflict, keep: Keep.Theirs })).json();

    expect(status.conflicts).toEqual([]);
    expect((await listNodes(store.db, scope)).find((n) => n.id === nodeId)?.data).toEqual({ text: 'theirs' });
  });

  it('refuses an unknown choice', async () => {
    const { store } = await divergedFolder();
    held.store = store;

    await expect(post({ conflict: store.folderStatus()!.conflicts[0], keep: 'both' })).rejects.toMatchObject({ status: 400 });
  });
});
