import type { Db } from '$lib/server/db/client';
import { fetchCanvasLink, importCanvasBytes, importCanvasLink } from '$lib/server/canvas/upload';
import { MAX_FONT_BYTES, storeFontBytes } from '$lib/server/motion/font-upload';
import { UPLOAD_MAX_BYTES } from '$lib/canvas/upload-kind';
import { frameStore } from '$lib/server/motion/move-element';
import type { Actor } from '$lib/server/repos/actor';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { rateWindow } from '$lib/server/figma/rate-window';
import { liveBrowser } from '$lib/server/web/live';
import { importPageAt, UrlImportOutcome, type UrlImported } from './import-url';
import { Tokening, type PageShape } from './url-doc';
import type { SiteBrand } from './page-tokens';
import { findSiteBrand } from '$lib/server/start/site-brand';
import { startHost } from '$lib/start-url';
import { componentsPage } from '$lib/server/canvas/components-page';

const MS_PER_MINUTE = 60_000;
const IMPORTS_PER_MINUTE = 4;
const MAX_SHEET_BYTES = 2_000_000;
const DATA_URL = /^data:(image\/[\w+.-]+);base64,(.*)$/;

const limiter = rateWindow({ limit: IMPORTS_PER_MINUTE, windowMs: MS_PER_MINUTE });

export type UrlScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export type PageAssets = { importImage: (url: string) => Promise<string>; importFont: (url: string) => Promise<string | null>; fetchText: (url: string) => Promise<string> };

export function pageAssets(scope: Pick<UrlScope, 'db' | 'orgId' | 'userId' | 'projectId'>): PageAssets {
  return {
    importImage: async (url) => {
      const inline = url.match(DATA_URL);
      const made = inline
        ? await importCanvasBytes(scope.db, { orgId: scope.orgId, projectId: scope.projectId, fileName: `snapshot.${inline[1].split('/')[1]}`, mime: inline[1], bytes: Buffer.from(inline[2], 'base64') })
        : await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.projectId, url, maxBytes: UPLOAD_MAX_BYTES.image });
      return made.asset.id;
    },
    importFont: async (url) => {
      const { fileName, bytes } = await fetchCanvasLink({ url, maxBytes: MAX_FONT_BYTES });
      const saved = await storeFontBytes(scope.db, { orgId: scope.orgId, userId: scope.userId, name: fileName, bytes });
      return saved.ok ? saved.assetId : null;
    },
    fetchText: async (url) => new TextDecoder().decode((await fetchCanvasLink({ url, maxBytes: MAX_SHEET_BYTES })).bytes)
  };
}

async function brandOf(scope: UrlScope, url: string): Promise<SiteBrand | undefined> {
  if (!URL.canParse(url)) {
    return undefined;
  }
  const brand = await findSiteBrand(scope.db, scope.orgId, startHost(url)).catch(() => null);
  return brand ? { palette: brand.kit.palette.map((swatch) => swatch.hex) } : undefined;
}

async function shapeFor(scope: UrlScope, url: string, shape: PageShape | undefined): Promise<PageShape | undefined> {
  if (shape?.tokening !== Tokening.On) {
    return shape;
  }
  const brand = await brandOf(scope, url);
  return brand ? { ...shape, brand } : shape;
}

export async function importUrlInto(scope: UrlScope, canvasId: string, ask: { url: string; at: { x: number; y: number }; maxHeight?: number; shape?: PageShape }): Promise<UrlImported> {
  if (!limiter.allow(scope.userId)) {
    return { outcome: UrlImportOutcome.RateLimited };
  }

  return importPageAt({
    ...ask,
    shape: await shapeFor(scope, ask.url, ask.shape),
    store: frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId }),
    place: { projectId: scope.projectId, canvasId },
    open: liveBrowser({ orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId }),
    guard: (url) => assertPublicUrl(url),
    ...pageAssets(scope),
    components: () => componentsPage(scope.db, scope),
    newId: () => crypto.randomUUID().slice(0, 8)
  });
}
