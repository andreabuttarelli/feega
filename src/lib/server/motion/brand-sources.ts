import type { Db } from '$lib/server/db/client';
import type { MotionToolDeps, SourceRead } from './motion-tools';
import { readSite } from './site-brief';
import { readBrand } from './brand-brief';
import { importImageAsset, storeImage } from './asset-import';

export type BrandSources = Required<Pick<MotionToolDeps, 'site' | 'brand' | 'importAsset'>>;

export function brandSources(db: Db, scope: { orgId: string; projectId: string; canvasId: string; brandId: string | null }): BrandSources {
  const drawnLogos = new Map<string, string>();

  return {
    site: async (url): Promise<SourceRead> => {
      const read = await readSite(url);
      if (!read.ok) {
        return read;
      }
      const logos = read.site.logos.map(({ markup, ...logo }) => {
        if (markup) {
          drawnLogos.set(logo.url, markup);
        }
        return logo;
      });
      return { ok: true, site: { ...read.site, logos } };
    },
    brand: (name) => readBrand(db, { orgId: scope.orgId, brandId: scope.brandId }, name),
    importAsset: (url, label) => {
      const markup = drawnLogos.get(url);
      return markup ? storeImage(db, scope, { bytes: Buffer.from(markup), url }, label) : importImageAsset(db, scope, url, label);
    }
  };
}
