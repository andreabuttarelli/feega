import type { Db } from '$lib/server/db/client';
import { findAssets } from '$lib/server/repos/assets';

export type EditInputs = { imagePaths: string[]; maskPath: string | null };

const refOf = (data: Record<string, unknown> | undefined, key: string): string | null => (typeof data?.[key] === 'string' && data[key] ? (data[key] as string) : null);

export async function editInputsOf(db: Db, scope: { orgId: string; data: Record<string, unknown> | undefined; wiredImagePaths: string[] }): Promise<EditInputs> {
  const maskId = refOf(scope.data, 'maskRefId');
  const imageId = refOf(scope.data, 'editImageRefId');
  const ids = [maskId, imageId].filter((id): id is string => id !== null);
  if (!ids.length) {
    return { imagePaths: scope.wiredImagePaths, maskPath: null };
  }

  const assets = await findAssets(db, { orgId: scope.orgId, assetIds: ids });
  const pathOf = (id: string | null): string | null => (id ? assets.get(id)?.url ?? null : null);
  const own = pathOf(imageId);
  return { imagePaths: own ? [own] : scope.wiredImagePaths, maskPath: pathOf(maskId) };
}
