import type { Db } from '$lib/server/db/client';
import { findAsset, insertAsset, type Asset } from '$lib/server/repos/assets';

async function findInLibrary(db: Db, input: { orgId: string; url: string }): Promise<Asset | null> {
  const { data, error } = await db
    .from('assets')
    .select('id')
    .eq('org_id', input.orgId)
    .is('project_id', null)
    .eq('url', input.url)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? findAsset(db, { orgId: input.orgId, assetId: data.id }) : null;
}

export async function saveToOrgLibrary(db: Db, input: { orgId: string; assetId: string }): Promise<Asset | null> {
  const asset = await findAsset(db, input);

  if (!asset) {
    return null;
  }

  if (asset.projectId === null) {
    return asset;
  }

  const existing = asset.url ? await findInLibrary(db, { orgId: input.orgId, url: asset.url }) : null;

  if (existing) {
    return existing;
  }

  return insertAsset(db, {
    orgId: input.orgId,
    projectId: null,
    type: asset.type,
    source: asset.source ?? 'upload',
    url: asset.url,
    content: asset.content,
    mimeType: asset.mimeType,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    durationS: asset.durationS,
    uncensored: asset.uncensored
  });
}
