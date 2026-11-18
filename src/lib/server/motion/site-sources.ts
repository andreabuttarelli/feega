import type { Db } from '$lib/server/db/client';
import type { MotionToolDeps, SourceRead } from './motion-tools';
import { readSite } from './site-brief';
import { CAPTURE_MAX_EDGE, importImageAsset, storeImage, type ImportScope } from './asset-import';
import { farmCapture } from './site-capture';
import { motionRenderFarm } from './renderer';
import { liveSiteChain } from '$lib/server/web/live';

export type SiteSources = Required<Pick<MotionToolDeps, 'site' | 'importAsset'>> & Pick<MotionToolDeps, 'capture'>;

export function siteSources(db: Db, scope: ImportScope & { userId: string }, spend: (usd: number) => void = () => undefined): SiteSources {
  const drawnLogos = new Map<string, string>();
  const farm = motionRenderFarm();

  return {
    site: async (url): Promise<SourceRead> => {
      const read = await readSite(url, liveSiteChain(scope));
      spend(read.costUsd);
      if (!read.ok) {
        return { ok: false, error: read.error };
      }
      const logos = read.site.logos.map(({ markup, ...logo }) => {
        if (markup) {
          drawnLogos.set(logo.url, markup);
        }
        return logo;
      });
      return { ok: true, site: { ...read.site, logos } };
    },
    importAsset: (url, label) => {
      const markup = drawnLogos.get(url);
      return markup ? storeImage(db, scope, { bytes: Buffer.from(markup), url }, label) : importImageAsset(db, scope, url, label);
    },
    capture: farm
      ? farmCapture(farm, async (shot, page) => {
          const stored = await storeImage(db, scope, { bytes: shot.bytes, url: page.url }, page.label, CAPTURE_MAX_EDGE);
          return stored.ok ? { part: shot.part, asset: stored.asset, width: stored.width ?? 0, height: stored.height ?? 0 } : { error: stored.error };
        })
      : undefined
  };
}
