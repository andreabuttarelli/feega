import type { Db } from '$lib/server/db/client';
import type { AssetSource } from '$lib/server/repos/assets';
import { BUCKET_BY_SOURCE } from '$lib/server/repos/asset-storage';
import { forgetSignedUrls } from '$lib/server/media-thumbnails';
import { NODE_ASSET_FIELDS } from './node-media';

export const QUARANTINE_BUCKET = 'quarantine';

export type StoredObject = { bucket: string; path: string };
export type ObjectMover = (from: StoredObject, to: StoredObject) => Promise<void>;
export type QuarantineScope = { orgId: string; reportId: string };

type StoredAsset = { id: string; url: string | null; source: string | null };

const EXTERNAL_URL = /^https?:\/\//;

const prefixOf = (scope: QuarantineScope): string => `${scope.orgId}/${scope.reportId}/`;

const bucketOf = (asset: StoredAsset): string => BUCKET_BY_SOURCE[(asset.source ?? 'upload') as AssetSource];

const isStored = (asset: StoredAsset): asset is StoredAsset & { url: string } => Boolean(asset.url) && !EXTERNAL_URL.test(asset.url!);

export function storageMover(db: Db): ObjectMover {
  return async (from, to) => {
    const { error } = await db.storage.from(from.bucket).move(from.path, to.path, { destinationBucket: to.bucket });
    if (error) {
      throw error;
    }
  };
}

async function nodeAssetIds(db: Db, orgId: string, nodeId: string): Promise<string[]> {
  const [{ data: node }, { data: runs }] = await Promise.all([
    db.from('nodes').select('data').eq('org_id', orgId).eq('id', nodeId).maybeSingle(),
    db.from('node_runs').select('output_asset_id').eq('org_id', orgId).eq('node_id', nodeId)
  ]);

  const data = (node?.data ?? {}) as Record<string, unknown>;
  const fromData = NODE_ASSET_FIELDS.map((field) => data[field]).filter((id): id is string => typeof id === 'string' && id.length > 0);
  const fromRuns = (runs ?? []).map((run) => run.output_asset_id).filter((id): id is string => Boolean(id));
  return [...new Set([...fromData, ...fromRuns])];
}

async function repoint(db: Db, asset: StoredAsset & { url: string }, url: string): Promise<void> {
  const { id, url: from } = asset;
  const { error } = await db.from('assets').update({ url }).eq('id', id).eq('url', from);
  if (error) {
    throw error;
  }
}

export async function quarantineNode(db: Db, move: ObjectMover, scope: QuarantineScope & { nodeId: string }): Promise<void> {
  const ids = await nodeAssetIds(db, scope.orgId, scope.nodeId);
  if (!ids.length) {
    return;
  }

  const { data, error } = await db.from('assets').select('id, url, source').eq('org_id', scope.orgId).in('id', ids);
  if (error) {
    throw error;
  }

  const prefix = prefixOf(scope);
  for (const asset of ((data ?? []) as StoredAsset[]).filter(isStored)) {
    if (asset.url.startsWith(prefix)) {
      continue;
    }
    const live = { bucket: bucketOf(asset), path: asset.url };
    const held = `${prefix}${live.path}`;
    await move(live, { bucket: QUARANTINE_BUCKET, path: held });
    await repoint(db, asset, held);
    forgetSignedUrls(live.bucket, live.path);
  }
}

export async function releaseQuarantine(db: Db, move: ObjectMover, scope: QuarantineScope): Promise<void> {
  const prefix = prefixOf(scope);
  const { data, error } = await db.from('assets').select('id, url, source').eq('org_id', scope.orgId).like('url', `${prefix}%`);
  if (error) {
    throw error;
  }

  for (const asset of ((data ?? []) as StoredAsset[]).filter(isStored)) {
    if (!asset.url.startsWith(prefix)) {
      continue;
    }
    const original = asset.url.slice(prefix.length);
    await move({ bucket: QUARANTINE_BUCKET, path: asset.url }, { bucket: bucketOf(asset), path: original });
    await repoint(db, asset, original);
  }
}
