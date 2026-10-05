import type { Db } from '$lib/server/db/client';
import type { MotionToolDeps } from './motion-tools';
import { readSite } from './site-brief';
import { readBrand } from './brand-brief';
import { importImageAsset } from './asset-import';

export type BrandSources = Required<Pick<MotionToolDeps, 'site' | 'brand' | 'importAsset'>>;

export function brandSources(db: Db, scope: { orgId: string; projectId: string; canvasId: string; brandId: string | null }): BrandSources {
  return {
    site: readSite,
    brand: (name) => readBrand(db, { orgId: scope.orgId, brandId: scope.brandId }, name),
    importAsset: (url, label) => importImageAsset(db, scope, url, label)
  };
}
