import { adoptDocLibrary } from '$lib/server/canvas/project-library';
import { coreEvent } from '$lib/server/core-usage';
import { CoreEvent } from '$lib/core-usage';
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
import type { PageView } from './page-views';
import { Tokening, type PageShape } from './url-doc';
import { componentsPage } from '$lib/server/canvas/components-page';
import { savePoster } from '$lib/server/motion/poster';
import type { PagePoster } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';

const MS_PER_MINUTE = 60_000;
const IMPORTS_PER_MINUTE = 4;
const MAX_SHEET_BYTES = 2_000_000;
const DATA_URL = /^data:(image\/[\w+.-]+);base64,(.*)$/;

const limiter = rateWindow({ limit: IMPORTS_PER_MINUTE, windowMs: MS_PER_MINUTE });

export type UrlScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export type PageAssets = { importImage: (url: string) => Promise<string>; importFont: (url: string, page: string) => Promise<string | null>; fetchText: (url: string) => Promise<string> };

export function pageAssets(scope: Pick<UrlScope, 'db' | 'orgId' | 'userId' | 'projectId'>): PageAssets {
  return {
    importImage: async (url) => {
      const inline = url.match(DATA_URL);
      const made = inline
        ? await importCanvasBytes(scope.db, { orgId: scope.orgId, projectId: scope.projectId, fileName: `snapshot.${inline[1].split('/')[1]}`, mime: inline[1], bytes: Buffer.from(inline[2], 'base64') })
        : await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.projectId, url, maxBytes: UPLOAD_MAX_BYTES.image });
      return made.asset.id;
    },
    importFont: async (url, page) => {
      const { fileName, bytes } = await fetchCanvasLink({ url, maxBytes: MAX_FONT_BYTES, referer: page });
      const saved = await storeFontBytes(scope.db, { orgId: scope.orgId, userId: scope.userId, name: fileName, bytes });
      return saved.ok ? saved.assetId : null;
    },
    fetchText: async (url) => new TextDecoder().decode((await fetchCanvasLink({ url, maxBytes: MAX_SHEET_BYTES })).bytes)
  };
}

async function keepPoster(scope: UrlScope, store: FrameStore, frameId: string, poster: PagePoster): Promise<void> {
  const head = await store.read(frameId);
  if (!head) {
    return;
  }
  const form = new FormData();
  form.set('file', new File([poster.bytes], 'poster.webp', { type: 'image/webp' }));
  form.set('width', String(poster.width));
  form.set('height', String(poster.height));
  form.set('revision', String(head.version));
  await savePoster(scope.db, { orgId: scope.orgId, projectId: scope.projectId, nodeId: frameId, actor: scope.actor, form });
}

export async function importUrlInto(scope: UrlScope, canvasId: string, ask: { url: string; at: { x: number; y: number }; maxHeight?: number; shape?: PageShape; views?: PageView[]; guard?: (url: URL) => Promise<void> }): Promise<UrlImported> {
  if (!limiter.allow(scope.userId)) {
    return { outcome: UrlImportOutcome.RateLimited };
  }

  const store = frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId });
  const imported = await importPageAt({
    ...ask,
    shape: ask.shape,
    store,
    place: { projectId: scope.projectId, canvasId },
    open: liveBrowser({ orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId }),
    guard: ask.guard ?? ((url) => assertPublicUrl(url)),
    ...pageAssets(scope),
    components: () => componentsPage(scope.db, scope),
    keepPoster: (frameId, poster) => keepPoster(scope, store, frameId, poster),
    newId: () => crypto.randomUUID().slice(0, 8)
  });
  if (imported.outcome !== UrlImportOutcome.Ok) {
    return imported;
  }
  const head = await store.read(imported.frameId);
  if (head) {
    await adoptDocLibrary(scope.db, scope, head.doc);
  }

  coreEvent(scope.userId, CoreEvent.UrlImported, { canvas_id: canvasId });
  return imported;
}
