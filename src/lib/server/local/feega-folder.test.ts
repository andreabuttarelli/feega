import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keep, Relation } from '@feega/canvas-folder';
import { createNode, listNodes, moveNode } from '$lib/server/repos/canvas';
import { LOCAL_ORG_ID, openFeegaStore, type FeegaStore, type FeegaStoreOptions } from './feega-store';

const ORIGIN = 'http://127.0.0.1:5173';
const actor = { kind: 'user' as const, id: null };
const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const tempDir = () => mkdtempSync(join(tmpdir(), 'feega-folder-'));
const open = (dir: string, options: Partial<FeegaStoreOptions> = {}) => openFeegaStore(dir, { origin: ORIGIN, ...options });
const nodeFile = (dir: string, id: string) => join(dir, '.feega', 'nodes', `${id}.json`);
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const scopeOf = (store: FeegaStore) => ({ orgId: LOCAL_ORG_ID, projectId: store.place.projectId, canvasId: store.place.canvasId });

async function textNode(store: FeegaStore, text: string) {
  const node = await createNode(store.db, { ...scopeOf(store), type: 'text', x: 0, y: 0, data: { text }, actor });
  await store.flush();
  return node.id;
}

async function textOf(store: FeegaStore, id: string) {
  const nodes = await listNodes(store.db, scopeOf(store));
  return nodes.find((n) => n.id === id);
}

function editOnDisk(dir: string, id: string, text: string) {
  const file = readJson(nodeFile(dir, id));
  writeJson(nodeFile(dir, id), { ...file, data: { ...file.data, text } });
}

describe('a project folder keeps its canvas in .feega/', () => {
  it('writes one sorted json file per node, with its version', async () => {
    const dir = tempDir();
    const id = await textNode(open(dir), 'hello');

    const text = readFileSync(nodeFile(dir, id), 'utf8');
    const keys = Object.keys(JSON.parse(text));
    expect(keys).toEqual([...keys].sort());
    expect(JSON.parse(text)).toMatchObject({ id, type: 'text', version: 1, data: { text: 'hello' } });
    expect(readFileSync(join(dir, '.feega', '.gitignore'), 'utf8')).toBe('.base/\n.ours/\n');
  });

  it('opens again what it wrote', async () => {
    const dir = tempDir();
    const id = await textNode(open(dir), 'hello');

    const reopened = open(dir);

    expect((await textOf(reopened, id))?.data).toEqual({ text: 'hello' });
    expect(reopened.folderStatus()?.relation).toBe(Relation.Same);
  });

  it('takes changes made on disk while closed and says so', async () => {
    const dir = tempDir();
    const id = await textNode(open(dir), 'hello');
    editOnDisk(dir, id, 'from git');

    const reopened = open(dir);

    expect((await textOf(reopened, id))?.data).toEqual({ text: 'from git' });
    expect(reopened.folderStatus()).toMatchObject({ relation: Relation.Behind, conflicts: [] });
  });

  it('never overwrites a change made on disk while open, and merges it on reopen', async () => {
    const dir = tempDir();
    const store = open(dir);
    const id = await textNode(store, 'hello');
    editOnDisk(dir, id, 'from git');

    await moveNode(store.db, { orgId: LOCAL_ORG_ID, nodeId: id, x: 300, y: 40 });
    await store.flush();

    expect(readJson(nodeFile(dir, id)).data.text).toBe('from git');
    expect(store.folderStatus()?.unsavedSince).not.toBeNull();

    const reopened = open(dir);
    const node = await textOf(reopened, id);
    expect(node).toMatchObject({ position: { x: 300, y: 40 }, data: { text: 'from git' } });
    expect(reopened.folderStatus()).toMatchObject({ relation: Relation.Diverged, conflicts: [] });
    expect(readJson(nodeFile(dir, id)).position.x).toBe(300);
  });

  it('keeps mine on a conflict, records theirs, and applies theirs on request', async () => {
    const dir = tempDir();
    const store = open(dir);
    const id = await textNode(store, 'hello');
    editOnDisk(dir, id, 'theirs');
    await store.db.from('nodes').update({ data: { text: 'mine' } as never }).eq('id', id);
    await store.flush();

    const reopened = open(dir);
    const [conflict] = reopened.folderStatus()!.conflicts;
    expect(conflict).toMatchObject({ collection: 'nodes', id, field: 'data.text', ours: 'mine', theirs: 'theirs' });
    expect((await textOf(reopened, id))?.data).toEqual({ text: 'mine' });
    expect(readJson(join(dir, '.feega', 'conflicts.json'))).toHaveLength(1);

    await reopened.resolveConflict(conflict, Keep.Theirs);

    expect((await textOf(reopened, id))?.data).toEqual({ text: 'theirs' });
    expect(reopened.folderStatus()?.conflicts).toEqual([]);
    expect(readJson(join(dir, '.feega', 'conflicts.json'))).toEqual([]);
  });

  it('moves an old single .feega file into the folder and keeps the file', async () => {
    const dir = tempDir();
    const legacy = join(dir, 'old.feega');
    const id = await textNode(openFeegaStore(legacy, { origin: ORIGIN }), 'legacy');
    renameSync(legacy, join(dir, '.feega'));

    const store = open(dir);

    expect((await textOf(store, id))?.data).toEqual({ text: 'legacy' });
    expect(statSync(join(dir, '.feega')).isDirectory()).toBe(true);
    expect(existsSync(join(dir, 'legacy.feega'))).toBe(true);
  });
});

describe('every asset of a local project lives in .feega/assets by hash', () => {
  function folderWithRemoteMedia(dir: string, urls: string[]) {
    const feega = join(dir, '.feega');
    mkdirSync(join(feega, 'media'), { recursive: true });
    mkdirSync(join(feega, 'nodes'), { recursive: true });
    const ids = urls.map(() => crypto.randomUUID());
    urls.forEach((url, i) => writeJson(join(feega, 'media', `${ids[i]}.json`), { id: ids[i], type: 'image', mimeType: 'image/png', url, width: 1, height: 1, durationS: null, content: null }));
    const node = crypto.randomUUID();
    writeJson(join(feega, 'nodes', `${node}.json`), { id: node, type: 'image', displayName: null, position: { x: 0, y: 0, z: 0 }, size: { width: null, height: null }, version: 1, data: { assetIds: ids } });
    return ids;
  }

  it('downloads remote media on open, stores it once by sha256 and references the hash', async () => {
    const dir = tempDir();
    const ids = folderWithRemoteMedia(dir, ['https://cdn.test/a.png', 'https://cdn.test/b.png']);

    const store = open(dir, { fetchAsset: async () => PNG });
    await store.flush();

    expect(readdirSync(join(dir, '.feega', 'assets'))).toEqual([`${sha(PNG)}.png`]);
    expect(readJson(join(dir, '.feega', 'media', `${ids[0]}.json`))).toMatchObject({ sha256: sha(PNG), ext: 'png' });
    expect(store.folderStatus()?.failedAssets).toEqual([]);
  });

  it('keeps going when one download fails and names it', async () => {
    const dir = tempDir();
    folderWithRemoteMedia(dir, ['https://cdn.test/ok.png', 'https://cdn.test/gone.png']);

    const store = open(dir, { fetchAsset: async (url) => (url.includes('gone') ? Promise.reject(new Error('404')) : PNG) });
    await store.flush();

    expect(readdirSync(join(dir, '.feega', 'assets'))).toEqual([`${sha(PNG)}.png`]);
    expect(store.folderStatus()?.failedAssets).toEqual(['https://cdn.test/gone.png']);
  });

  it('reads the asset bytes back from the folder on reopen', async () => {
    const dir = tempDir();
    const ids = folderWithRemoteMedia(dir, ['https://cdn.test/a.png']);
    await open(dir, { fetchAsset: async () => PNG }).flush();

    const reopened = open(dir, { fetchAsset: async () => Promise.reject(new Error('offline')) });
    const { data } = await reopened.db.from('assets').select('id, url').eq('id', ids[0]).single();

    expect(reopened.blob('canvas-assets', String((data as { url: string }).url))?.bytes).toEqual(PNG);
  });
});
