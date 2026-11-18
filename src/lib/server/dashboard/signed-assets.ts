import type { Db } from '$lib/server/db/client';
import { findAssets, type Asset } from '$lib/server/repos/assets';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import type { ThumbnailPreset } from '$lib/server/media-thumbnails';

const ABSOLUTE_URL = /^https?:\/\//;

export async function signedAssets(
  db: Db,
  orgId: string,
  ids: string[],
  preset?: ThumbnailPreset
): Promise<{ assets: Map<string, Asset>; urls: Record<string, string | null> }> {
  const assets = await findAssets(db, { orgId, assetIds: ids });
  const all = [...assets.values()];
  const stored = all.filter((a) => a.url && !ABSOLUTE_URL.test(a.url));
  const signed = await signAssetPaths(
    db,
    createAssetSigningDb(),
    {
      generated: stored.filter((a) => a.source === 'generated').map((a) => a.url!),
      uploaded: stored.filter((a) => a.source !== 'generated').map((a) => a.url!)
    },
    undefined,
    preset
  );
  const urlOf = (url: string) => (ABSOLUTE_URL.test(url) ? url : (signed.get(url) ?? null));
  return { assets, urls: Object.fromEntries(all.map((a) => [a.id, a.url ? urlOf(a.url) : null])) };
}
