import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { signThumbnailUrls } from '$lib/server/media-thumbnails';
import { QUARANTINE_BUCKET, quarantineNode, releaseQuarantine, type StoredObject } from './asset-quarantine';
import { CANVAS_ASSET_BUCKET, signStoredFile } from '$lib/server/repos/asset-storage';

const ORG = 'org-1';
const REPORT = 'rep-1';
const NODE = 'node-1';
const UPLOAD = `${ORG}/proj/upload.png`;
const GENERATED = 'user-1/media/gen.png';

function objectStore(keys: string[]) {
  const objects = new Set(keys);
  const key = (o: StoredObject) => `${o.bucket}:${o.path}`;

  const move = async (from: StoredObject, to: StoredObject) => {
    if (!objects.delete(key(from))) {
      throw new Error(`no object ${key(from)}`);
    }
    objects.add(key(to));
  };

  const bucket = (name: string) => ({
    createSignedUrl: async (path: string) =>
      objects.has(`${name}:${path}`)
        ? { data: { signedUrl: `https://signed.example/${name}/${path}` }, error: null }
        : { data: null, error: { message: 'Object not found', statusCode: '404' } },
    createSignedUrls: async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: objects.has(`${name}:${path}`) ? `https://signed.example/${name}/${path}` : null })),
      error: null
    })
  });

  return { objects, move, bucket };
}

function world(assets: Record<string, unknown>[], storageKeys: string[]) {
  const store = objectStore(storageKeys);
  const fake = fakeDb(
    {
      nodes: [{ id: NODE, org_id: ORG, data: { assetId: 'a-upload' } }],
      node_runs: [{ id: 'run-1', org_id: ORG, node_id: NODE, output_asset_id: 'a-gen' }],
      assets
    },
    { filter: true, mutate: true }
  );
  const db = { from: fake.db.from, storage: { from: store.bucket } } as unknown as Db;
  return { db, fake, store };
}

const uploadAsset = () => ({ id: 'a-upload', org_id: ORG, url: UPLOAD, source: 'upload', uncensored: false });
const generatedAsset = () => ({ id: 'a-gen', org_id: ORG, url: GENERATED, source: 'generated', uncensored: true });

describe('quarantineNode', () => {
  it('moves every file of the node into quarantine and points the rows there', async () => {
    const assets = [uploadAsset(), generatedAsset()];
    const { db, store } = world(assets, [`${CANVAS_ASSET_BUCKET}:${UPLOAD}`, `brand-knowledge:${GENERATED}`]);

    await quarantineNode(db, store.move, { orgId: ORG, reportId: REPORT, nodeId: NODE });

    expect([...store.objects].sort()).toEqual([
      `${QUARANTINE_BUCKET}:${ORG}/${REPORT}/${UPLOAD}`,
      `${QUARANTINE_BUCKET}:${ORG}/${REPORT}/${GENERATED}`
    ]);
    expect(assets.map((a) => a.url)).toEqual([`${ORG}/${REPORT}/${UPLOAD}`, `${ORG}/${REPORT}/${GENERATED}`]);
  });

  it('a URL for the old path no longer resolves', async () => {
    const { db, store } = world([uploadAsset()], [`${CANVAS_ASSET_BUCKET}:${UPLOAD}`]);
    expect(await signStoredFile(db, CANVAS_ASSET_BUCKET, UPLOAD, 60)).not.toBeNull();

    await quarantineNode(db, store.move, { orgId: ORG, reportId: REPORT, nodeId: NODE });

    expect(await signStoredFile(db, CANVAS_ASSET_BUCKET, UPLOAD, 60)).toBeNull();
  });

  it('drops the reused signature, so the next read does not hand out the dead URL', async () => {
    const { db, store } = world([uploadAsset()], [`${CANVAS_ASSET_BUCKET}:${UPLOAD}`]);
    const source = { name: CANVAS_ASSET_BUCKET, open: () => store.bucket(CANVAS_ASSET_BUCKET) };
    expect((await signThumbnailUrls(source, [UPLOAD], 3600)).get(UPLOAD)).toBeDefined();

    await quarantineNode(db, store.move, { orgId: ORG, reportId: REPORT, nodeId: NODE });

    expect((await signThumbnailUrls(source, [UPLOAD], 3600)).get(UPLOAD)).toBeUndefined();
  });

  it('leaves a link to an outside URL alone: there is no object to move', async () => {
    const external = { ...uploadAsset(), url: 'https://cdn.example/x.png', source: 'imported' };
    const { db, store } = world([external], []);

    await quarantineNode(db, store.move, { orgId: ORG, reportId: REPORT, nodeId: NODE });

    expect(external.url).toBe('https://cdn.example/x.png');
  });
});

describe('releaseQuarantine', () => {
  it('moves the files back where they came from and restores the rows', async () => {
    const assets = [uploadAsset(), generatedAsset()];
    const { db, store } = world(assets, [`${CANVAS_ASSET_BUCKET}:${UPLOAD}`, `brand-knowledge:${GENERATED}`]);
    await quarantineNode(db, store.move, { orgId: ORG, reportId: REPORT, nodeId: NODE });

    await releaseQuarantine(db, store.move, { orgId: ORG, reportId: REPORT });

    expect([...store.objects].sort()).toEqual([`brand-knowledge:${GENERATED}`, `${CANVAS_ASSET_BUCKET}:${UPLOAD}`]);
    expect(assets.map((a) => a.url)).toEqual([UPLOAD, GENERATED]);
  });

  it('touches nothing quarantined under another report', async () => {
    const other = { ...uploadAsset(), url: `${ORG}/rep-2/${UPLOAD}` };
    const { db, store } = world([other], [`${QUARANTINE_BUCKET}:${ORG}/rep-2/${UPLOAD}`]);

    await releaseQuarantine(db, store.move, { orgId: ORG, reportId: REPORT });

    expect(other.url).toBe(`${ORG}/rep-2/${UPLOAD}`);
  });
});
