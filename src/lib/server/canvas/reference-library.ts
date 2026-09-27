import type { Db } from '$lib/server/db/client';
import { listProjectAssets } from '$lib/server/repos/assets';
import { listCatalogueImages, type CatalogueImage } from '$lib/server/repos/reference-images';

export type ReferenceLibrary = { catalogue: CatalogueImage[]; media: { id: string }[] };

export async function referenceLibrary(db: Db, scope: { orgId: string; projectId: string }): Promise<ReferenceLibrary> {
  const [catalogue, assets] = await Promise.all([listCatalogueImages(db), listProjectAssets(db, scope)]);
  return {
    catalogue,
    media: assets.filter((asset) => asset.type === 'image' && asset.url).map((asset) => ({ id: asset.id }))
  };
}
