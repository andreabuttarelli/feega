import type { Db } from '$lib/server/db/client';
import { importCanvasLink } from '$lib/server/canvas/upload';
import { UPLOAD_MAX_BYTES } from '$lib/canvas/upload-kind';
import { frameStore } from '$lib/server/motion/move-element';
import type { Actor } from '$lib/server/repos/actor';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { rateWindow } from '$lib/server/figma/rate-window';
import { liveBrowser } from '$lib/server/web/live';
import { importPageAt, UrlImportOutcome, type UrlImported } from './import-url';

const MS_PER_MINUTE = 60_000;
const IMPORTS_PER_MINUTE = 4;

const limiter = rateWindow({ limit: IMPORTS_PER_MINUTE, windowMs: MS_PER_MINUTE });

export type UrlScope = { db: Db; orgId: string; userId: string; projectId: string; actor: Actor };

export async function importUrlInto(scope: UrlScope, canvasId: string, ask: { url: string; at: { x: number; y: number } }): Promise<UrlImported> {
  if (!limiter.allow(scope.userId)) {
    return { outcome: UrlImportOutcome.RateLimited };
  }

  const importImage = async (url: string) => (await importCanvasLink(scope.db, { orgId: scope.orgId, projectId: scope.projectId, url, maxBytes: UPLOAD_MAX_BYTES.image })).asset.id;

  return importPageAt({
    ...ask,
    store: frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId }),
    place: { projectId: scope.projectId, canvasId },
    open: liveBrowser({ orgId: scope.orgId, userId: scope.userId, projectId: scope.projectId }),
    guard: (url) => assertPublicUrl(url),
    importImage,
    newId: () => crypto.randomUUID().slice(0, 8)
  });
}
