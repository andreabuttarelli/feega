import type { Db } from '$lib/server/db/client';
import { findAssets, type Asset } from '$lib/server/repos/assets';
import { createAssetSigningDb, signAssetPaths } from '$lib/server/canvas/sign-media';
import type { ThumbnailPreset } from '$lib/server/media-thumbnails';

export async function signedAssets(
  db: Db,
  orgId: string,
  ids: string[],
  preset?: ThumbnailPreset
): Promise<{ assets: Map<string, Asset>; urls: Record<string, string | null> }> {
  const assets = await findAssets(db, { orgId, assetIds: ids });
  const all = [...assets.values()];
  const signed = await signAssetPaths(
    db,
    createAssetSigningDb(),
    {
      generated: all.filter((a) => a.source === 'generated' && a.url).map((a) => a.url!),
      uploaded: all.filter((a) => a.source !== 'generated' && a.url).map((a) => a.url!)
    },
    undefined,
    preset
  );
  return { assets, urls: Object.fromEntries(all.map((a) => [a.id, a.url ? (signed.get(a.url) ?? null) : null])) };
}
